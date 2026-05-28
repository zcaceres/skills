#!/usr/bin/env bun
// Release a single skill: build, tarball, GH release, skills.sh publish.
//
// Usage: bun run release <skill-name> [--dry-run]
//
// Assumes the version in skills/<name>/package.json is already bumped (via
// changesets `bun run version`). Tag format: <skill-name>@<version>.

import { $ } from "bun";
import { readFile } from "node:fs/promises";
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
await $`tar -czf ${tarball} -C ${join(src, "dist")} .`;

if (dryRun) {
  console.log(`Dry run: tarball at ${tarball}`);
  process.exit(0);
}

await $`git tag ${tag}`;
await $`git push origin ${tag}`;
await $`gh release create ${tag} ${tarball} --title ${tag} --notes "Release ${tag}"`;

// skills.sh publish — wire in once the CLI/API is finalized.
// await $`skills publish ${src}`;

console.log(`Published ${tag}`);
