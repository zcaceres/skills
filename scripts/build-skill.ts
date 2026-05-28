#!/usr/bin/env bun
// Build a single skill into dist/.
// - Resolves {{ include "shared/..." }} directives in entry files.
// - Runs the skill's `fetch-tools` script if defined.
// - Copies the entry file for each agent into dist/<agent>/ and any bundled
//   binaries from shared/bin/ (or wherever `skill.tools.binDir` points).
//
// Usage: bun run build <skill-name>

import { $ } from "bun";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

const name = process.argv[2];
if (!name) {
  console.error("Usage: bun run build <skill-name>");
  process.exit(1);
}

const root = join(import.meta.dir, "..");
const src = join(root, "skills", name);
const out = join(src, "dist");

if (!existsSync(src)) {
  console.error(`skills/${name} not found.`);
  process.exit(1);
}

const pkg = JSON.parse(await readFile(join(src, "package.json"), "utf8"));
const entries: Record<string, string> = pkg.skill?.entry ?? {};

const includeRe = /\{\{\s*include\s+"([^"]+)"\s*\}\}/g;
async function resolveIncludes(text: string, baseDir: string): Promise<string> {
  const replacements: Array<[string, string]> = [];
  for (const match of text.matchAll(includeRe)) {
    const target = join(baseDir, match[1]);
    const body = await readFile(target, "utf8");
    replacements.push([match[0], body]);
  }
  return replacements.reduce((acc, [from, to]) => acc.replaceAll(from, to), text);
}

await mkdir(out, { recursive: true });

if (pkg.scripts?.["fetch-tools"]) {
  await $`bun run --cwd ${src} fetch-tools`.quiet();
}

for (const [agent, relPath] of Object.entries(entries)) {
  const srcPath = join(src, relPath);
  const dstPath = join(out, agent, relPath);
  await mkdir(dirname(dstPath), { recursive: true });
  const resolved = await resolveIncludes(await readFile(srcPath, "utf8"), src);
  await writeFile(dstPath, resolved);
}

const binDir = pkg.skill?.tools?.binDir;
if (binDir && existsSync(join(src, binDir))) {
  await cp(join(src, binDir), join(out, binDir), { recursive: true });
}

console.log(`Built skills/${name}/dist`);
