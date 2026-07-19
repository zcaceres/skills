#!/usr/bin/env bun
// Lint every skill against the skills.sh standard:
// - SKILL.md exists at the skill root
// - frontmatter is well-formed YAML (the skills.sh CLI parses strictly and
//   silently drops any skill whose frontmatter it can't parse — an unquoted
//   `: ` in a description is the classic trap)
// - frontmatter has name + description
// - frontmatter `name` matches the parent folder name exactly

import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { readSkillMeta } from "./lib/skill-meta";

// Extract and strict-parse the YAML frontmatter block. Throws on invalid YAML.
async function assertFrontmatterYaml(skillMdPath: string): Promise<void> {
  const text = await readFile(skillMdPath, "utf8");
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    throw new Error("missing YAML frontmatter");
  }
  try {
    Bun.YAML.parse(match[1]);
  } catch (err) {
    throw new Error(
      `invalid frontmatter YAML — ${(err as Error).message.split("\n")[0]} ` +
        `(an unquoted ": " inside a description is the usual cause)`,
    );
  }
}

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
    await assertFrontmatterYaml(skillMd);
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
