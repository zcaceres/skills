#!/usr/bin/env bun
// Build a single skill into dist/ in skills.sh-publishable shape.
// - Runs the skill's `fetch-tools` script (if defined) to populate scripts/.
// - Copies SKILL.md + scripts/ + references/ + assets/ + agents/ into dist/.
// - Reads name/description from SKILL.md frontmatter purely for logging; the
//   manifest IS the frontmatter, there's no other source of truth.
//
// Usage: bun run build <skill-name>

import { $ } from "bun";
import { cp, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { readSkillMeta } from "./lib/skill-meta";

const name = process.argv[2];
if (!name) {
  console.error("Usage: bun run build <skill-name>");
  process.exit(1);
}

const root = join(import.meta.dir, "..");
const src = join(root, "skills", name);
const out = join(src, "dist", name);

if (!existsSync(src)) {
  console.error(`skills/${name} not found.`);
  process.exit(1);
}

const meta = await readSkillMeta(join(src, "SKILL.md"));
if (meta.name !== name) {
  console.error(`SKILL.md frontmatter name "${meta.name}" must match folder "${name}".`);
  process.exit(1);
}

const pkg = JSON.parse(await readFile(join(src, "package.json"), "utf8"));

if (pkg.scripts?.["fetch-tools"]) {
  await $`bun run --cwd ${src} fetch-tools`.quiet();
}

await mkdir(out, { recursive: true });
await cp(join(src, "SKILL.md"), join(out, "SKILL.md"));

for (const dir of ["scripts", "references", "assets", "agents"]) {
  const from = join(src, dir);
  if (existsSync(from)) {
    await cp(from, join(out, dir), { recursive: true });
  }
}

console.log(`Built skills/${name}/dist/${name} (${meta.description})`);
