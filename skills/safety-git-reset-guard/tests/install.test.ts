import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const installer = resolve(import.meta.dir, "../scripts/install.sh");
const runner = resolve(import.meta.dir, "../scripts/run.sh");
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function makeTempDir(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "safety-git-reset-install-"));
  tempDirs.push(path);
  return path;
}

async function runInstaller(args: string[], env: Record<string, string>) {
  const proc = Bun.spawn([installer, ...args], {
    env: { ...process.env, ...env },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
}

describe("install.sh", () => {
  test("installs a user-scoped Codex hook and is idempotent", async () => {
    const root = await makeTempDir();
    const codexHome = join(root, "codex");
    await mkdir(codexHome, { recursive: true });
    await writeFile(
      join(codexHome, "hooks.json"),
      JSON.stringify({
        description: "existing",
        hooks: {
          PostToolUse: [
            { matcher: "Bash", hooks: [{ type: "command", command: "echo existing" }] },
          ],
        },
      })
    );

    const first = await runInstaller(["--codex"], { CODEX_HOME: codexHome });
    expect(first.exitCode).toBe(0);
    expect(first.stdout).toContain("Open /hooks in Codex");

    const second = await runInstaller(["--codex"], { CODEX_HOME: codexHome });
    expect(second.exitCode).toBe(0);
    expect(second.stdout).toContain("already wired");

    const config = JSON.parse(await readFile(join(codexHome, "hooks.json"), "utf8"));
    expect(config.description).toBe("existing");
    expect(config.hooks.PostToolUse).toHaveLength(1);
    expect(config.hooks.PreToolUse).toEqual([
      {
        matcher: "Bash",
        hooks: [{ type: "command", command: runner }],
      },
    ]);
  });

  test("installs a project-scoped Codex hook", async () => {
    const root = await makeTempDir();
    const project = join(root, "project");
    await mkdir(project, { recursive: true });

    const proc = Bun.spawn([installer, "--codex", "--project"], {
      cwd: project,
      env: process.env,
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(await proc.exited).toBe(0);

    const config = JSON.parse(
      await readFile(join(project, ".codex", "hooks.json"), "utf8")
    );
    expect(config.hooks.PreToolUse[0].hooks[0].command).toBe(runner);
  });

  test("supports an explicit target", async () => {
    const root = await makeTempDir();
    const target = join(root, "custom", "hooks.json");

    const result = await runInstaller(["--codex", "--target", target], {});
    expect(result.exitCode).toBe(0);
    const config = JSON.parse(await readFile(target, "utf8"));
    expect(config.hooks.PreToolUse[0].matcher).toBe("Bash");
  });
});
