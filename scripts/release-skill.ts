#!/usr/bin/env bun
// Release a single skill: build, tarball, GH release.
//
// Usage: bun run release <skill-name> [--dry-run]
//
// Assumes the version in skills/<name>/package.json is already bumped (via
// changesets `bun run version`). Tag format: <skill-name>@<version>.

import { $ } from "bun";
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const name = process.argv[2];
const dryRun = process.argv.includes("--dry-run");
if (!name) {
  console.error("Usage: bun run release <skill-name> [--dry-run]");
  process.exit(1);
}

const root = join(import.meta.dir, "..");
const src = join(root, "skills", name);
if (!existsSync(src)) {
  console.error(`skills/${name} not found.`);
  process.exit(1);
}

const pkg = JSON.parse(await readFile(join(src, "package.json"), "utf8"));
const version = pkg.version;
const tag = `${name}@${version}`;
const tarball = join(src, `${name}-${version}.tgz`);

console.log(`Releasing ${tag}`);

await $`bun run build ${name}`;
// Tarball contents follow skills.sh: a single top-level dir named <name>/
// containing SKILL.md + optional scripts/references/assets/agents.
await $`tar -czf ${tarball} -C ${join(src, "dist")} ${name}`;

// Standalone per-platform binaries (skills that bundle a compiled hook). These
// ride along as individual release assets so a file-copy install can download
// just its host binary via scripts/fetch-binary.sh. Empty for binary-less skills.
const binDir = join(src, "dist", name, "scripts", "bin");
const binaries = existsSync(binDir)
  ? (await readdir(binDir)).map((f) => join(binDir, f))
  : [];

if (dryRun) {
  console.log(`Dry run: tarball at ${tarball}`);
  if (binaries.length) {
    console.log(`Dry run: ${binaries.length} binary asset(s):`);
    for (const b of binaries) console.log(`  ${b}`);
  }
  process.exit(0);
}

await $`git tag ${tag}`;
await $`git push origin ${tag}`;
await $`gh release create ${tag} ${tarball} ${binaries} --title ${tag} --notes "Release ${tag}"`;

// No registry publish: the `skills` CLI installs directly from this GitHub
// repo and has no `publish` command. If one ever ships, wire it in here.

console.log(`Published ${tag}`);
