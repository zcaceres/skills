// Tiny SKILL.md frontmatter reader. We only need a handful of scalar fields
// for build/check tooling — name, description, and the occasional optional
// field — so a regex parser is enough. If we ever need nested YAML, swap in
// the `yaml` package.

import { readFile } from "node:fs/promises";

export type SkillMeta = {
  name: string;
  description: string;
  raw: Record<string, string>;
};

export async function readSkillMeta(skillMdPath: string): Promise<SkillMeta> {
  const text = await readFile(skillMdPath, "utf8");
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    throw new Error(`${skillMdPath}: missing YAML frontmatter`);
  }
  const raw: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    // Top-level keys only (no leading whitespace). Value may be empty when
    // the field is a block-style mapping or sequence on subsequent lines —
    // we only care that the key exists for capability/parity checks.
    const kv = line.match(/^([A-Za-z][\w-]*)\s*:\s*(.*?)\s*$/);
    if (!kv) continue;
    raw[kv[1]] = kv[2].replace(/^["'](.*)["']$/, "$1");
  }
  if (!raw.name || !raw.description) {
    throw new Error(`${skillMdPath}: frontmatter must include name and description`);
  }
  return { name: raw.name, description: raw.description, raw };
}
