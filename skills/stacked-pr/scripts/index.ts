#!/usr/bin/env bun
/**
 * PostToolUse hook bundled with /stacked-pr. Injects a soft
 * system-reminder when the uncommitted diff in the current repo crosses
 * size/file thresholds without a commit, nudging the agent to run
 * /stacked-pr checkpoint to land the slice as a stacked PR.
 *
 * Output is JSON on stdout (additionalContext) — never blocks the agent.
 * Every error path returns silently; the hook must never break the loop.
 *
 * Ported from the standalone pr-size-nudge skill. State file and binary
 * names are namespaced to stacked-pr-nudge to avoid colliding with an
 * older standalone pr-size-nudge install during the deprecation window.
 */

import { mkdir, readFile, realpath, writeFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";
import { z } from "zod";

// === Schemas ===

const StdinSchema = z
  .object({
    cwd: z.string(),
    session_id: z.string(),
  })
  .passthrough();

const StateEntrySchema = z.object({
  lastFireAt: z.number(),
  lastFireLines: z.number(),
  lastFireFiles: z.number(),
});
type StateEntry = z.infer<typeof StateEntrySchema>;

const StateSchema = z.record(z.string(), StateEntrySchema);
type State = z.infer<typeof StateSchema>;

// === Config ===

const HOME = homedir();
const STATE_DIR = join(HOME, ".claude", "state");
const STATE_FILE = join(STATE_DIR, "stacked-pr-nudge.json");

const DEFAULT_EXCLUDE_GLOBS = [
  "bun.lock",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "Cargo.lock",
  "go.sum",
  "Gemfile.lock",
  "*.snap",
  "dist/**",
  "build/**",
  "*.min.js",
  "*.min.css",
];

const THRESHOLD_LINES = Number(process.env.STACKED_PR_NUDGE_LINES ?? process.env.PR_NUDGE_LINES ?? 300);
const THRESHOLD_FILES = Number(process.env.STACKED_PR_NUDGE_FILES ?? process.env.PR_NUDGE_FILES ?? 8);

const REFIRE_AFTER_MS = 30 * 60 * 1000;
const REFIRE_LINES_DELTA = 150;
const REFIRE_FILES_DELTA = 3;
const SWEEP_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
const SUBPROCESS_TIMEOUT_MS = 300;
const UNTRACKED_LINE_CAP = 2000;

const SKIP_ROOTS = (process.env.STACKED_PR_NUDGE_SKIP_ROOTS ?? process.env.PR_NUDGE_SKIP_ROOTS ?? "")
  .split(":")
  .filter((p) => p.length > 0);

const EXCLUDE_GLOBS = (
  process.env.STACKED_PR_NUDGE_EXCLUDE ?? process.env.PR_NUDGE_EXCLUDE ?? DEFAULT_EXCLUDE_GLOBS.join(":")
)
  .split(":")
  .filter((p) => p.length > 0);

// === Path canonicalization (handles /tmp vs /private/tmp on macOS) ===

async function canonicalize(p: string): Promise<string> {
  try {
    return await realpath(p);
  } catch {
    return p;
  }
}

// === Subprocess with timeout ===

async function runGit(args: string[], cwd: string): Promise<string | null> {
  const proc = Bun.spawn(["git", "-C", cwd, ...args], {
    stdout: "pipe",
    stderr: "ignore",
  });
  const timer = setTimeout(() => proc.kill(), SUBPROCESS_TIMEOUT_MS);
  try {
    const stdout = proc.stdout as ReadableStream<Uint8Array>;
    const [output, exitCode] = await Promise.all([
      new Response(stdout).text(),
      proc.exited,
    ]);
    if (exitCode !== 0) return null;
    return output;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// === Glob matching (gitignore-style) ===

export function globToRegex(glob: string): RegExp {
  const anchored = glob.includes("/");
  const PLACEHOLDER = " ";
  let pattern = glob.replace(/\./g, "\\.");
  pattern = pattern.replace(/\*\*/g, PLACEHOLDER);
  pattern = pattern.replace(/\*/g, anchored ? "[^/]*" : ".*");
  pattern = pattern.replace(new RegExp(PLACEHOLDER, "g"), ".*");
  return new RegExp("^" + pattern + "$");
}

const EXCLUDE_REGEXES = EXCLUDE_GLOBS.map((g) => ({
  re: globToRegex(g),
  anchored: g.includes("/"),
}));

export function isExcluded(path: string): boolean {
  const basename = path.split("/").pop() ?? path;
  for (const { re, anchored } of EXCLUDE_REGEXES) {
    if (anchored) {
      if (re.test(path)) return true;
    } else {
      if (re.test(basename)) return true;
    }
  }
  return false;
}

// === Diff stats ===

interface DiffStats {
  lines: number;
  files: number;
}

async function computeDiffStats(repoRoot: string): Promise<DiffStats> {
  let lines = 0;
  let files = 0;

  const numstat = await runGit(["diff", "--numstat", "HEAD"], repoRoot);
  if (numstat !== null) {
    for (const line of numstat.split("\n")) {
      if (!line.trim()) continue;
      const parts = line.split("\t");
      if (parts.length < 3) continue;
      const add = parts[0];
      const del = parts[1];
      const path = parts[2];
      if (add === undefined || del === undefined || path === undefined) continue;
      if (isExcluded(path)) continue;
      const addN = add === "-" ? 0 : Number(add) || 0;
      const delN = del === "-" ? 0 : Number(del) || 0;
      lines += addN + delN;
      files += 1;
    }
  }

  const status = await runGit(["status", "--porcelain=v1"], repoRoot);
  if (status !== null) {
    for (const line of status.split("\n")) {
      if (!line.startsWith("?? ")) continue;
      const path = line.slice(3);
      if (isExcluded(path)) continue;
      files += 1;
      try {
        const content = await readFile(join(repoRoot, path), "utf-8");
        const fileLines = content.split("\n").length;
        lines += Math.min(fileLines, UNTRACKED_LINE_CAP);
      } catch {
        // unreadable file (binary, gone, permissions) — skip line count
      }
    }
  }

  return { lines, files };
}

// === Dedup state ===

async function loadState(): Promise<State> {
  try {
    const text = await readFile(STATE_FILE, "utf-8");
    return StateSchema.parse(JSON.parse(text));
  } catch {
    return {};
  }
}

async function saveState(state: State): Promise<void> {
  await mkdir(STATE_DIR, { recursive: true });
  const now = Date.now();
  const swept: State = {};
  for (const [k, v] of Object.entries(state)) {
    if (now - v.lastFireAt < SWEEP_AFTER_MS) swept[k] = v;
  }
  await writeFile(STATE_FILE, JSON.stringify(swept, null, 2));
}

export function shouldFire(entry: StateEntry | undefined, current: DiffStats): boolean {
  if (!entry) return true;
  const now = Date.now();
  if (now - entry.lastFireAt > REFIRE_AFTER_MS) return true;
  if (current.lines - entry.lastFireLines > REFIRE_LINES_DELTA) return true;
  if (current.files - entry.lastFireFiles > REFIRE_FILES_DELTA) return true;
  return false;
}

// === Output ===

export function buildNudgeMessage(lines: number, files: number): string {
  return (
    `Uncommitted diff is ${lines} lines across ${files} files without a commit. ` +
    `If this work forms a shippable slice, run /stacked-pr checkpoint to land it as a stacked PR before continuing.`
  );
}

function emitNudge(lines: number, files: number): void {
  const payload = {
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: buildNudgeMessage(lines, files),
    },
  };
  process.stdout.write(JSON.stringify(payload));
}

// === Main ===

async function main(): Promise<void> {
  try {
    const input = await Bun.stdin.text();
    if (!input.trim()) return;
    const data = StdinSchema.parse(JSON.parse(input));

    const topRaw = await runGit(["rev-parse", "--show-toplevel"], data.cwd);
    if (topRaw === null) return;
    const repoRoot = topRaw.trim();
    if (!repoRoot) return;

    const canonicalHome = await canonicalize(HOME);
    if (repoRoot === canonicalHome) return;
    const canonicalSkips = await Promise.all(SKIP_ROOTS.map(canonicalize));
    if (canonicalSkips.includes(repoRoot)) return;

    const stats = await computeDiffStats(repoRoot);
    if (stats.lines < THRESHOLD_LINES && stats.files < THRESHOLD_FILES) return;

    const state = await loadState();
    const key = `${data.session_id}:${repoRoot}`;
    const entry = state[key];
    if (!shouldFire(entry, stats)) return;

    state[key] = {
      lastFireAt: Date.now(),
      lastFireLines: stats.lines,
      lastFireFiles: stats.files,
    };
    await saveState(state);
    emitNudge(stats.lines, stats.files);
  } catch {
    // Soft fail — never block the agent.
  }
}

if (import.meta.main) {
  main();
}
