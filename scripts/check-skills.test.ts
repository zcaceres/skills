// Guard: every skill's SKILL.md frontmatter must be well-formed YAML.
//
// The skills.sh CLI parses frontmatter strictly and silently drops any skill it
// can't parse, so `skills add -s <name>` matches nothing and `skills update
// <name>` fails. The repo's own readSkillMeta is a lenient line-by-line reader
// that never catches this, which is how an unquoted `: ` in a description
// shipped undetected. This test parses each block with a strict YAML parser.

import { test, expect } from "bun:test";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const skillsDir = join(import.meta.dir, "..", "skills");

const skills = readdirSync(skillsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((name) => existsSync(join(skillsDir, name, "SKILL.md")));

test.each(skills)("%s frontmatter is valid YAML", (name) => {
  const text = readFileSync(join(skillsDir, name, "SKILL.md"), "utf8");
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  expect(match, `${name}: missing YAML frontmatter`).not.toBeNull();
  expect(() => Bun.YAML.parse(match![1])).not.toThrow();
});
