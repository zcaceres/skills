#!/usr/bin/env bun
// Generate Claude Code plugins from the flat skills/ tree.
//
// The repo's skills use a `<group>-<name>` prefix as a poor-man's namespace
// (the skills.sh CLI is flat). Claude Code plugins give real namespacing via
// the plugin name, so this build:
//   - groups skills/<group>-* into one plugin per <group>
//   - strips the prefix from each skill's folder + frontmatter `name`
//     (so the plugin yields /<group>:<name>, not /<group>:<group>-<name>)
//   - repoints in-body script paths (skills/<full>/scripts/...) and hook
//     command paths (~/.claude/skills/<full>/...) at ${CLAUDE_PLUGIN_ROOT}
//   - lifts each skill's frontmatter `hooks:` into the plugin's hooks/hooks.json
//     (always-on once the plugin is enabled) and drops it from the copied
//     SKILL.md, since the frontmatter path no longer resolves under a plugin
//   - writes each plugin's .claude-plugin/plugin.json and the top-level
//     .claude-plugin/marketplace.json catalog
//
// plugins/ and .claude-plugin/marketplace.json are FULLY GENERATED — edit the
// originals under skills/, never the copies. Re-run with: bun run build:plugins
//
// Usage: bun run build:plugins [--validate]

import { $ } from "bun";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const skillsDir = join(root, "skills");
const pluginsDir = join(root, "plugins");
const marketplaceFile = join(root, ".claude-plugin", "marketplace.json");

// ── Catalog config ──────────────────────────────────────────────────────────
// Shared author/repo metadata stamped onto every plugin manifest.
const AUTHOR = { name: "Zach Caceres" } as const;
const REPO = "https://github.com/zcaceres/skills";
const PLUGIN_VERSION = "0.1.0";

const MARKETPLACE = {
  name: "zcaceres-skills",
  description:
    "Zach Caceres' open-source AI agent skills, packaged as installable Claude Code plugins.",
  owner: AUTHOR,
};

type PluginConfig = {
  // Folder prefix in skills/ (and the plugin name / namespace).
  prefix: string;
  description: string;
  // Force `disable-model-invocation: true` on every skill (user-triggered only).
  userTriggered?: boolean;
};

const PLUGINS: PluginConfig[] = [
  {
    prefix: "security",
    description:
      "Repo + endpoint security setup: OpenSSF Scorecard, gitleaks, Snyk, Socket, and the bumblebee endpoint scanner. User-triggered via /security:<tool>.",
    userTriggered: true,
  },
  {
    prefix: "quality",
    description:
      "Code-quality analysis: chaos-monkey bug hunting, dead-code/duplication detection, perf review, docs audits, CLI agent-friendliness, and project-health scoring.",
  },
  // `safety` is intentionally deferred. Its guards run a Bun `--compile`
  // binary (scripts/bin/, built on demand, gitignored). A git-hosted plugin
  // marketplace copies files with no build step, so the binary can't ship —
  // and the executables are too large to commit. Re-enabling needs run.sh
  // to run the source at runtime (e.g. `bun run index.ts`) instead of a
  // precompiled binary. The hook-lifting machinery below already handles its
  // `hooks:` frontmatter once that's resolved.
];

// skills.sh-specific install guidance baked into some descriptions. Under a
// plugin the hooks/hooks.json is always-on with no install step, so this
// sentence is misleading — strip it from generated output.
const SKILLS_SH_INSTALL =
  / ?Frontmatter (?:block|hook) fires only when this skill is active in context; run `scripts\/install\.sh` after `npx skills add` for always-on protection\./g;

// One-line summary for the generated README table: first sentence, capped.
function summarize(desc: string): string {
  const first = desc.replace(SKILLS_SH_INSTALL, "").split(/(?<=\.)\s/)[0].trim();
  if (first.length <= 120) return first;
  return first.slice(0, 117).replace(/\s+\S*$/, "") + "…";
}

// Strip `<!-- plugin:omit -->…<!-- /plugin:omit -->` regions from a body.
// Skills mark skills.sh/Codex-specific install + manual-wiring prose this way:
// the HTML comments are invisible to skills.sh (markdown ignores them) but the
// generator drops the wrapped text, since a plugin's hooks.json wires the hook
// automatically and those sections (full of path-like `/<full>` references)
// would otherwise mislead plugin users and snag the reference rewrites.
function stripOmitRegions(text: string): string {
  return text
    .replace(/<!--\s*plugin:omit\s*-->[\s\S]*?<!--\s*\/plugin:omit\s*-->/g, "")
    .replace(/\n{3,}/g, "\n\n");
}

// ── Frontmatter helpers ─────────────────────────────────────────────────────
type Split = { frontmatter: string; body: string };

function splitFrontmatter(text: string, where: string): Split {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error(`${where}: missing YAML frontmatter`);
  return { frontmatter: m[1], body: m[2] };
}

// Rewrite the frontmatter TEXT (not a re-serialized parse, so the description
// survives byte-for-byte): rename `name`, drop the `hooks:` block, and append
// `disable-model-invocation: true` when the plugin is user-triggered.
function transformFrontmatter(
  fmText: string,
  opts: { stripped: string; userTriggered: boolean },
): string {
  const lines = fmText.split(/\r?\n/);
  const out: string[] = [];
  let hasDisable = false;
  for (let i = 0; i < lines.length; i++) {
    const top = lines[i].match(/^([A-Za-z][\w-]*)\s*:/);
    if (top?.[1] === "hooks") {
      // Skip the key line and every following indented (child) line.
      while (i + 1 < lines.length && /^[ \t]/.test(lines[i + 1])) i++;
      continue;
    }
    if (top?.[1] === "name") {
      out.push(`name: ${opts.stripped}`);
      continue;
    }
    if (top?.[1] === "disable-model-invocation") hasDisable = true;
    out.push(lines[i]);
  }
  while (out.length && out[out.length - 1].trim() === "") out.pop();
  if (opts.userTriggered && !hasDisable) out.push("disable-model-invocation: true");
  return out.join("\n");
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Body + frontmatter path/slash rewrites. Both are ANCHORED so they only touch
// runtime references, never path segments inside install docs:
//   - script paths: a repo-relative `skills/<full>/scripts/` (something the
//     skill tells Claude to run) — but NOT `~/.claude/skills/<full>/scripts/`
//     inside skills.sh install instructions (negative lookbehind on /~.\w-).
//   - slash commands: `/<full>` preceded by whitespace/punctuation — but NOT
//     the `/<full>` inside a path like `skills/<full>` (lookbehind on word/dot).
// Script paths run first; the slash rewrite would otherwise eat the `/<full>`
// in `/<full>/scripts/` and leave the path half-rewritten.
function rewriteReferences(
  text: string,
  opts: { full: string; stripped: string; plugin: string },
): string {
  const full = escapeRe(opts.full);
  return text
    .replace(
      new RegExp(`(?<![\\w./~-])skills/${full}/scripts/`, "g"),
      `\${CLAUDE_PLUGIN_ROOT}/skills/${opts.stripped}/scripts/`,
    )
    .replace(
      new RegExp(`(?<![\\w.])/${full}`, "g"),
      `/${opts.plugin}:${opts.stripped}`,
    );
}

// SKILL.md frontmatter hook shape ({matcher, type, command}) → hooks.json shape
// ({matcher, hooks: [{type, command}]}), with the command path repointed at the
// plugin root.
type FrontmatterHookEntry = {
  matcher?: string;
  type?: string;
  command?: string;
  [k: string]: unknown;
};

function liftHooks(
  parsed: Record<string, FrontmatterHookEntry[]>,
  opts: { full: string; stripped: string },
): Record<string, unknown[]> {
  const out: Record<string, unknown[]> = {};
  for (const [event, entries] of Object.entries(parsed)) {
    out[event] = entries.map((e) => {
      const { matcher, ...rest } = e;
      if (typeof rest.command === "string") {
        rest.command = rest.command.replaceAll(
          `~/.claude/skills/${opts.full}/`,
          `\${CLAUDE_PLUGIN_ROOT}/skills/${opts.stripped}/`,
        );
      }
      return { matcher, hooks: [rest] };
    });
  }
  return out;
}

// ── Build ───────────────────────────────────────────────────────────────────
const allSkills = (await readdir(skillsDir, { withFileTypes: true }))
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

await rm(pluginsDir, { recursive: true, force: true });

const catalog: Array<{ name: string; source: string; description: string }> = [];
let skillCount = 0;

for (const cfg of PLUGINS) {
  const members = allSkills
    .filter((n) => n.startsWith(`${cfg.prefix}-`))
    .sort();
  if (members.length === 0) {
    console.warn(`⚠ no skills/${cfg.prefix}-* found — skipping plugin ${cfg.prefix}`);
    continue;
  }

  const pluginRoot = join(pluginsDir, cfg.prefix);
  const mergedHooks: Record<string, unknown[]> = {};
  const rows: string[] = [];

  for (const full of members) {
    const stripped = full.slice(cfg.prefix.length + 1);
    const src = join(skillsDir, full);
    const dst = join(pluginRoot, "skills", stripped);
    await mkdir(dst, { recursive: true });

    const raw = await readFile(join(src, "SKILL.md"), "utf8");
    const { frontmatter, body } = splitFrontmatter(raw, `skills/${full}/SKILL.md`);

    // Lift hooks (read-only parse) before stripping them from the copy.
    const parsedFm = (Bun.YAML.parse(frontmatter) ?? {}) as Record<string, unknown>;
    if (parsedFm.hooks) {
      const lifted = liftHooks(
        parsedFm.hooks as Record<string, FrontmatterHookEntry[]>,
        { full, stripped },
      );
      for (const [event, entries] of Object.entries(lifted)) {
        (mergedHooks[event] ??= []).push(...entries);
      }
    }

    const newFm = transformFrontmatter(frontmatter, {
      stripped,
      userTriggered: !!cfg.userTriggered,
    });
    const skillMd = rewriteReferences(
      `---\n${newFm}\n---\n${stripOmitRegions(body)}`,
      { full, stripped, plugin: cfg.prefix },
    ).replace(SKILLS_SH_INSTALL, "");
    await writeFile(join(dst, "SKILL.md"), skillMd);

    // Carry the skill's own payload; skip monorepo plumbing (package.json,
    // CHANGELOG, LICENSE, tests) and the per-skill README — Claude Code never
    // surfaces it, and these copies duplicate skills.sh-specific install docs.
    // The generated plugin README is the human-facing doc.
    for (const dir of ["scripts", "references", "assets"]) {
      if (existsSync(join(src, dir))) {
        await cp(join(src, dir), join(dst, dir), { recursive: true });
      }
    }

    rows.push(`| \`/${cfg.prefix}:${stripped}\` | ${summarize(String(parsedFm.description ?? ""))} |`);
    skillCount++;
  }

  // plugin.json
  await mkdir(join(pluginRoot, ".claude-plugin"), { recursive: true });
  await writeFile(
    join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify(
      {
        name: cfg.prefix,
        description: cfg.description,
        version: PLUGIN_VERSION,
        author: AUTHOR,
        homepage: REPO,
        repository: REPO,
        license: "MIT",
      },
      null,
      2,
    ) + "\n",
  );

  // hooks/hooks.json (only if any member contributed hooks)
  if (Object.keys(mergedHooks).length) {
    await mkdir(join(pluginRoot, "hooks"), { recursive: true });
    await writeFile(
      join(pluginRoot, "hooks", "hooks.json"),
      JSON.stringify({ hooks: mergedHooks }, null, 2) + "\n",
    );
  }

  // README.md
  const readme =
    `# ${cfg.prefix} (Claude Code plugin)\n\n${cfg.description}\n\n` +
    `| Skill | What it does |\n|---|---|\n${rows.join("\n")}\n\n` +
    (Object.keys(mergedHooks).length
      ? `Hooks in \`hooks/hooks.json\` activate automatically once the plugin is enabled.\n\n`
      : "") +
    `## Install\n\n\`\`\`shell\n/plugin marketplace add zcaceres/skills\n/plugin install ${cfg.prefix}@${MARKETPLACE.name}\n\`\`\`\n\n` +
    `## Develop / test locally\n\n\`\`\`bash\nclaude --plugin-dir ./plugins/${cfg.prefix}\n/reload-plugins   # after edits\n\`\`\`\n\n` +
    `> Generated from \`skills/${cfg.prefix}-*\` by \`bun run build:plugins\`. Edit the originals under \`skills/\`, not these copies.\n`;
  await writeFile(join(pluginRoot, "README.md"), readme);

  catalog.push({
    name: cfg.prefix,
    source: `./plugins/${cfg.prefix}`,
    description: cfg.description,
  });
  console.log(`✓ ${cfg.prefix}: ${members.length} skill(s)${Object.keys(mergedHooks).length ? " + hooks" : ""}`);
}

// marketplace.json
await mkdir(join(root, ".claude-plugin"), { recursive: true });
await writeFile(
  marketplaceFile,
  JSON.stringify({ ...MARKETPLACE, plugins: catalog }, null, 2) + "\n",
);

console.log(
  `\nGenerated ${catalog.length} plugin(s), ${skillCount} skill(s) → plugins/ + .claude-plugin/marketplace.json`,
);

// ── Optional validation (--validate, needs the claude CLI) ──────────────────
if (process.argv.includes("--validate")) {
  if (!(await $`command -v claude`.quiet().nothrow()).exitCode) {
    let bad = 0;
    for (const p of catalog) {
      const r = await $`claude plugin validate ${join(pluginsDir, p.name)}`.nothrow().quiet();
      if (r.exitCode) {
        bad++;
        console.error(`✗ ${p.name}\n${r.stderr.toString() || r.stdout.toString()}`);
      } else {
        console.log(`✓ validated ${p.name}`);
      }
    }
    const mr = await $`claude plugin validate ${marketplaceFile}`.nothrow().quiet();
    if (mr.exitCode) {
      bad++;
      console.error(`✗ marketplace\n${mr.stderr.toString() || mr.stdout.toString()}`);
    } else {
      console.log(`✓ validated marketplace`);
    }
    if (bad) process.exit(1);
  } else {
    console.warn("⚠ --validate: claude CLI not on PATH; skipping");
  }
}
