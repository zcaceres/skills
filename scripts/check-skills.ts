#!/usr/bin/env bun
// Lint every skill against the skills.sh standard:
// - SKILL.md exists at the skill root
// - frontmatter has name + description
// - frontmatter `name` matches the parent folder name exactly

import { readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { readSkillMeta } from "./lib/skill-meta";

const root = join(import.meta.dir, "..");
const skillsDir = join(root, "skills");
const names = (await readdir(skillsDir, { withFileTypes: true }))
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

let failed = 0;
for (const name of names) {
  const skillMd = join(skillsDir, name, "SKILL.md");
  if (!existsSync(skillMd)) {
    console.error(`✗ ${name}: missing SKILL.md`);
    failed++;
    continue;
  }
  try {
    const meta = await readSkillMeta(skillMd);
    if (meta.name !== name) {
      console.error(
        `✗ ${name}: frontmatter name "${meta.name}" must match folder "${name}"`,
      );
      failed++;
    }
  } catch (err) {
    console.error(`✗ ${name}: ${(err as Error).message}`);
    failed++;
  }
}

if (failed > 0) {
  console.error(`${failed} problem(s) found.`);
  process.exit(1);
}
console.log(`All ${names.length} skills look healthy.`);
