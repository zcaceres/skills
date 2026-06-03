#!/usr/bin/env bun
// Build a hook skill, tarball it (replicating release.yml), extract into a
// throwaway dir, then drive scripts/run.sh with the same `{ tool_name,
// tool_input }` envelope Claude Code emits. Proves the *shipped artifact* —
// not just the .ts source — blocks what it should and allows what it should.
//
// Usage: bun run scripts/smoke-bundle.ts [skill-name]   (default: safety-rm-rf-guard)

import { $ } from "bun";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const skill = process.argv[2] ?? "safety-rm-rf-guard";
const root = join(import.meta.dir, "..");
const buildScript = join(root, "scripts", "build-skill.ts");

type Case = {
  label: string;
  command: string;
  expect: 0 | 2;
  stderrContains?: string;
  // Defaults to "Bash". Override when smoking a hook that gates on a different
  // tool (e.g. a Read-path case for safety-dotenv-guard). Always serialised on
  // the wire so the bundled binary sees the same envelope Claude Code emits.
  toolName?: string;
};

const casesBySkill: Record<string, Case[]> = {
  "safety-rm-rf-guard": [
    { label: "rm file.txt blocked",      command: "rm file.txt",            expect: 2, stderrContains: "BLOCKED" },
    { label: "rm -rf blocked",           command: "rm -rf directory/",      expect: 2, stderrContains: "BLOCKED" },
    { label: "sudo rm blocked",          command: "sudo rm file",           expect: 2, stderrContains: "BLOCKED" },
    { label: "find -delete blocked",     command: "find . -delete",         expect: 2, stderrContains: "BLOCKED" },
    { label: "/bin/rm blocked",          command: "/bin/rm file.txt",       expect: 2 },
    { label: "ls -la allowed",           command: "ls -la",                 expect: 0 },
    { label: "git rm allowed",           command: "git rm file.ts",         expect: 0 },
    { label: "quoted rm allowed",        command: "echo 'rm test'",         expect: 0 },
  ],
};

const cases = casesBySkill[skill];
if (!cases) {
  console.error(`no smoke cases defined for "${skill}". Add an entry to casesBySkill.`);
  process.exit(1);
}

console.log(`▸ building skills/${skill}...`);
await $`bun run ${buildScript} ${skill}`;

const distRoot = join(root, "skills", skill, "dist");
const tarStage = await mkdtemp(join(tmpdir(), "skills-smoke-tar-"));
const tar = join(tarStage, `${skill}.tgz`);

console.log(`▸ packaging tarball...`);
await $`tar -czf ${tar} -C ${distRoot} ${skill}`;

const installRoot = await mkdtemp(join(tmpdir(), "skills-smoke-install-"));
await $`tar -xzf ${tar} -C ${installRoot}`;
const runSh = join(installRoot, skill, "scripts", "run.sh");

console.log(`▸ driving ${runSh}\n`);

let failed = 0;
for (const c of cases) {
  const proc = Bun.spawn([runSh], { stdin: "pipe", stdout: "pipe", stderr: "pipe" });
  const payload = { tool_name: c.toolName ?? "Bash", tool_input: { command: c.command } };
  proc.stdin.write(JSON.stringify(payload));
  proc.stdin.end();
  const code = await proc.exited;
  const stderr = await new Response(proc.stderr).text();
  const okExit = code === c.expect;
  const okErr = !c.stderrContains || stderr.includes(c.stderrContains);
  if (okExit && okErr) {
    console.log(`  ✓ ${c.label}`);
  } else {
    failed++;
    const detail = okExit
      ? `stderr missing "${c.stderrContains}": ${stderr.slice(0, 160).trim()}`
      : `exit=${code}, want ${c.expect}`;
    console.log(`  ✗ ${c.label}  (${detail})`);
  }
}

await rm(tarStage, { recursive: true, force: true });
await rm(installRoot, { recursive: true, force: true });

if (failed > 0) {
  console.error(`\n${failed} of ${cases.length} cases failed`);
  process.exit(1);
}
console.log(`\nall ${cases.length} cases passed`);
