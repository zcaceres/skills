// Tiny SKILL.md frontmatter reader.

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
    // Top-level keys only (no leading whitespace); we only care that the key exists.
    const kv = line.match(/^([A-Za-z][\w-]*)\s*:\s*(.*?)\s*$/);
    if (!kv) continue;
    raw[kv[1]] = kv[2].replace(/^["'](.*)["']$/, "$1");
  }
  if (!raw.name || !raw.description) {
    throw new Error(
      `${skillMdPath}: frontmatter must include name and description`,
    );
  }
  return { name: raw.name, description: raw.description, raw };
}
