#!/usr/bin/env bun
// Scaffold a new skill from _template/.
// Usage: bun run new <skill-name> "<one-line description>"

import { cp, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const [name, ...descParts] = process.argv.slice(2);
const description = descParts.join(" ");

if (!name || !description) {
  console.error('Usage: bun run new <skill-name> "<one-line description>"');
  process.exit(1);
}

if (!/^[a-z][a-z0-9-]*$/.test(name)) {
  console.error("Skill name must be lowercase kebab-case.");
  process.exit(1);
}

const root = join(import.meta.dir, "..");
const dest = join(root, "skills", name);

if (existsSync(dest)) {
  console.error(`skills/${name} already exists.`);
  process.exit(1);
}

await cp(join(root, "_template"), dest, { recursive: true });

// In package.json the description sits inside a JSON string literal, so any
// inner `"` or `\` must be escaped or the file won't parse. Markdown/YAML
// templates take the description verbatim — embedded quotes are fine inside
// an unquoted YAML scalar.
const jsonEscaped = JSON.stringify(description).slice(1, -1);

for (const file of ["package.json", "SKILL.md", "README.md"]) {
  const path = join(dest, file);
  const contents = await readFile(path, "utf8");
  const desc = file === "package.json" ? jsonEscaped : description;
  await writeFile(
    path,
    contents
      .replaceAll("__SKILL_NAME__", name)
      .replaceAll("__ONE_LINE_DESCRIPTION__", desc),
  );
}

console.log(`Created skills/${name}`);
console.log("Next: edit SKILL.md, then `bun install` to link the workspace.");
