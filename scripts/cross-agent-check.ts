#!/usr/bin/env bun
// Cross-agent parity check (integration test).
//
// For each skill that declares `crossAgent` in its package.json, verify that
// every agent in `crossAgent.supports` honors every frontmatter field in
// `crossAgent.requires`. Also verify those required fields are actually
// present in SKILL.md.
//
// Catches the silent-drift failure mode: a skill is published as
// "supports codex" but its load-bearing field (e.g. `hooks`) is dropped on
// the floor by Codex, so install succeeds but behavior is gone.
//
// Usage:
//   bun run cross-agent           # check every skill
//   bun run cross-agent <name>    # check one skill

import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { readSkillMeta } from "./lib/skill-meta";
import capabilities from "./lib/agent-capabilities.json";

type AgentName = keyof typeof capabilities.agents;

type CrossAgentManifest = {
  supports: AgentName[];
  requires: string[];
};

type Finding = { skill: string; level: "ok" | "warn" | "fail"; message: string };

const root = join(import.meta.dir, "..");
const skillsDir = join(root, "skills");

const only = process.argv[2];
const names = (await readdir(skillsDir, { withFileTypes: true }))
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((n) => !only || n === only);

if (only && names.length === 0) {
  console.error(`No skill named "${only}".`);
  process.exit(1);
}

const findings: Finding[] = [];

for (const name of names) {
  const skillDir = join(skillsDir, name);
  const pkgPath = join(skillDir, "package.json");
  if (!existsSync(pkgPath)) continue;

  const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
  const cross: CrossAgentManifest | undefined = pkg.crossAgent;

  if (!cross) {
    findings.push({
      skill: name,
      level: "warn",
      message: "no `crossAgent` declaration in package.json — skipping parity check",
    });
    continue;
  }

  const meta = await readSkillMeta(join(skillDir, "SKILL.md"));
  const fmKeys = new Set(Object.keys(meta.raw));

  // 1. Every required field must actually be present in SKILL.md frontmatter.
  for (const field of cross.requires) {
    if (!fmKeys.has(field)) {
      findings.push({
        skill: name,
        level: "fail",
        message: `requires "${field}" but SKILL.md frontmatter does not contain it`,
      });
    }
  }

  // 2. For each declared agent, every required field must be in its capability list.
  for (const agent of cross.supports) {
    const cap = capabilities.agents[agent];
    if (!cap) {
      findings.push({
        skill: name,
        level: "fail",
        message: `unknown agent "${agent}" — update scripts/lib/agent-capabilities.json`,
      });
      continue;
    }
    const supported = new Set(cap.frontmatter);
    const dropped = cross.requires.filter((f) => !supported.has(f));

    if (dropped.length === 0) {
      findings.push({
        skill: name,
        level: "ok",
        message: `${agent} honors all required fields (${cross.requires.join(", ")})`,
      });
    } else {
      findings.push({
        skill: name,
        level: "fail",
        message: `${agent} drops required field(s): ${dropped.join(", ")}. Skill will install but the corresponding behavior is silently lost.`,
      });
    }
  }
}

// Render
let fails = 0;
const groups = new Map<string, Finding[]>();
for (const f of findings) {
  if (!groups.has(f.skill)) groups.set(f.skill, []);
  groups.get(f.skill)!.push(f);
}

for (const [skill, group] of groups) {
  console.log(skill);
  for (const f of group) {
    const sigil = f.level === "ok" ? "✓" : f.level === "warn" ? "⚠" : "✗";
    console.log(`  ${sigil} ${f.message}`);
    if (f.level === "fail") fails++;
  }
}

if (fails > 0) {
  console.error(`\n${fails} parity failure(s).`);
  process.exit(1);
}
console.log(`\nAll cross-agent parity checks passed.`);
