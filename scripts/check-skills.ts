#!/usr/bin/env bun
// Lint every skill: package.json has skill metadata, entries exist on disk.

import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const skillsDir = join(root, "skills");
const names = (await readdir(skillsDir, { withFileTypes: true }))
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

let failed = 0;
for (const name of names) {
  const pkgPath = join(skillsDir, name, "package.json");
  if (!existsSync(pkgPath)) {
    console.error(`✗ ${name}: missing package.json`);
    failed++;
    continue;
  }
  const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
  const entries = pkg.skill?.entry ?? {};
  if (Object.keys(entries).length === 0) {
    console.error(`✗ ${name}: no skill.entry agents declared`);
    failed++;
    continue;
  }
  for (const [agent, rel] of Object.entries(entries)) {
    if (!existsSync(join(skillsDir, name, rel as string))) {
      console.error(`✗ ${name}: entry for ${agent} missing (${rel})`);
      failed++;
    }
  }
}

if (failed > 0) {
  console.error(`${failed} problem(s) found.`);
  process.exit(1);
}
console.log(`All ${names.length} skills look healthy.`);
