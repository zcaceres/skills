#!/usr/bin/env bun
/**
 * Diff-size nudge hook bundled with /pr. Injects a soft system-reminder
 * when the uncommitted diff in the current repo crosses size/file
 * thresholds without a commit, nudging the agent to run /pr to land the
 * work as a focused PR (a stacked checkpoint in stacked mode).
 *
 * Host-agnostic: the same binary serves Claude Code (PostToolUse hook)
 * and Gemini CLI (AfterTool hook). It reads the host's event name from
 * the payload and echoes it back in the output envelope, and homes its
 * state file under the matching config dir (~/.claude or ~/.gemini). The
 * settings wiring (event name + tool matcher) is the only host-specific
 * piece, and that lives in install.sh, not here.
 *
 * Output is JSON on stdout (additionalContext) — never blocks the agent.
 * Every error path returns silently; the hook must never break the loop.
 *
 * State file and binary names are namespaced to pr-nudge. The
 * STACKED_PR_NUDGE_* env vars are still honored as aliases.
 */

import { mkdir, readFile, realpath, writeFile } from "fs/promises";
import { homedir } from "os";
import { dirname, join } from "path";
import { z } from "zod";

// === Schemas ===

const StdinSchema = z
  .object({
    cwd: z.string(),
    session_id: z.string(),
    // Gemini CLI sends the event name in the payload; Claude Code omits it.
    // Used to echo the right envelope and home state under the right config dir.
    hook_event_name: z.string().optional(),
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

// State lives under the config dir of whichever host fired the hook, keyed off
// the payload's event name (AfterTool → Gemini, else Claude Code). Overridable
// with PR_NUDGE_STATE_DIR for non-standard layouts.
export function stateFileFor(hookEventName: string | undefined): string {
  const dir =
    process.env.PR_NUDGE_STATE_DIR ??
    join(HOME, hookEventName === "AfterTool" ? ".gemini" : ".claude", "state");
  return join(dir, "pr-nudge.json");
}

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

const THRESHOLD_LINES = Number(process.env.PR_NUDGE_LINES ?? process.env.STACKED_PR_NUDGE_LINES ?? 200);
const THRESHOLD_FILES = Number(process.env.PR_NUDGE_FILES ?? process.env.STACKED_PR_NUDGE_FILES ?? 4);

const REFIRE_AFTER_MS = 30 * 60 * 1000;
const REFIRE_LINES_DELTA = 150;
const REFIRE_FILES_DELTA = 3;
const SWEEP_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
const SUBPROCESS_TIMEOUT_MS = 300;
const UNTRACKED_LINE_CAP = 2000;

const SKIP_ROOTS = (process.env.PR_NUDGE_SKIP_ROOTS ?? process.env.STACKED_PR_NUDGE_SKIP_ROOTS ?? "")
  .split(":")
  .filter((p) => p.length > 0);

const EXCLUDE_GLOBS = (
  process.env.PR_NUDGE_EXCLUDE ?? process.env.STACKED_PR_NUDGE_EXCLUDE ?? DEFAULT_EXCLUDE_GLOBS.join(":")
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

// Run a command in `cwd`, returning stdout on exit 0 or null on any failure
// (nonzero exit, missing binary, timeout). Used for both git and jj.
async function runCmd(argv: string[], cwd: string): Promise<string | null> {
  const proc = Bun.spawn(argv, {
    cwd,
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

const runGit = (args: string[], cwd: string) => runCmd(["git", ...args], cwd);
const runJj = (args: string[], cwd: string) => runCmd(["jj", ...args], cwd);

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

type Vcs = "git" | "jj";

interface DiffStats {
  lines: number;
  files: number;
}

// Parse `jj diff --git -r @` (a standard unified diff) into a git-numstat-style
// stat: added+deleted hunk lines summed, one file per `diff --git` block, with
// isExcluded applied per path. jj has no untracked concept — new files already
// live in the working commit `@` and show up here as full-file additions — so
// there is no separate untracked pass and no per-file line cap.
export function parseJjDiffStat(gitDiff: string): DiffStats {
  let lines = 0;
  let files = 0;
  let inCountedFile = false;

  for (const line of gitDiff.split("\n")) {
    if (line.startsWith("diff --git ")) {
      // Header form: `diff --git a/<old> b/<new>`. Take the b/ path.
      const m = line.match(/ b\/(.*)$/);
      const path = m?.[1];
      inCountedFile = path !== undefined && !isExcluded(path);
      if (inCountedFile) files += 1;
      continue;
    }
    if (!inCountedFile) continue;
    // Skip the per-file `--- a/x` / `+++ b/x` headers; count real hunk lines.
    if (line.startsWith("+++ ") || line.startsWith("--- ")) continue;
    if (line.startsWith("+") || line.startsWith("-")) lines += 1;
  }

  return { lines, files };
}

async function computeGitDiffStats(repoRoot: string): Promise<DiffStats> {
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

async function computeDiffStats(repoRoot: string, vcs: Vcs): Promise<DiffStats> {
  if (vcs === "jj") {
    // Working-copy commit @ vs its parent: everything uncommitted lives in @.
    const gitDiff = await runJj(["diff", "--git", "-r", "@"], repoRoot);
    if (gitDiff === null) return { lines: 0, files: 0 };
    return parseJjDiffStat(gitDiff);
  }
  return computeGitDiffStats(repoRoot);
}

// === Dedup state ===

async function loadState(stateFile: string): Promise<State> {
  try {
    const text = await readFile(stateFile, "utf-8");
    return StateSchema.parse(JSON.parse(text));
  } catch {
    return {};
  }
}

async function saveState(stateFile: string, state: State): Promise<void> {
  await mkdir(dirname(stateFile), { recursive: true });
  const now = Date.now();
  const swept: State = {};
  for (const [k, v] of Object.entries(state)) {
    if (now - v.lastFireAt < SWEEP_AFTER_MS) swept[k] = v;
  }
  await writeFile(stateFile, JSON.stringify(swept, null, 2));
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
    `If this work forms a shippable slice, run /pr to land it as a focused PR before continuing.`
  );
}

function emitNudge(lines: number, files: number, hookEventName: string): void {
  const payload = {
    hookSpecificOutput: {
      hookEventName,
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

    // Resolve the repo root + VCS. Try git first so a colocated repo
    // (both .git and .jj) is driven as git — matching the skill's default
    // and keeping today's behavior unchanged. Fall back to native jj.
    let repoRoot = "";
    let vcs: Vcs = "git";
    const gitTop = await runGit(["rev-parse", "--show-toplevel"], data.cwd);
    if (gitTop !== null && gitTop.trim()) {
      repoRoot = gitTop.trim();
      vcs = "git";
    } else {
      const jjTop = await runJj(["root"], data.cwd);
      if (jjTop === null || !jjTop.trim()) return;
      repoRoot = jjTop.trim();
      vcs = "jj";
    }

    const canonicalHome = await canonicalize(HOME);
    if (repoRoot === canonicalHome) return;
    const canonicalSkips = await Promise.all(SKIP_ROOTS.map(canonicalize));
    if (canonicalSkips.includes(repoRoot)) return;

    const stats = await computeDiffStats(repoRoot, vcs);
    if (stats.lines < THRESHOLD_LINES && stats.files < THRESHOLD_FILES) return;

    const stateFile = stateFileFor(data.hook_event_name);
    const state = await loadState(stateFile);
    const key = `${data.session_id}:${repoRoot}`;
    const entry = state[key];
    if (!shouldFire(entry, stats)) return;

    state[key] = {
      lastFireAt: Date.now(),
      lastFireLines: stats.lines,
      lastFireFiles: stats.files,
    };
    await saveState(stateFile, state);
    // Echo the host's event name back (Claude Code omits it → PostToolUse).
    emitNudge(stats.lines, stats.files, data.hook_event_name ?? "PostToolUse");
  } catch {
    // Soft fail — never block the agent.
  }
}

if (import.meta.main) {
  main();
}
