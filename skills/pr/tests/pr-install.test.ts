import { afterEach, describe, expect, test } from "bun:test";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function fixture(): { home: string; scripts: string } {
  const root = mkdtempSync(join(tmpdir(), "pr-install-"));
  tempDirs.push(root);
  const home = join(root, "home");
  const scripts = join(root, "skill", "scripts");
  mkdirSync(home, { recursive: true });
  mkdirSync(scripts, { recursive: true });
  cpSync(join(import.meta.dir, "..", "scripts", "install.sh"), join(scripts, "install.sh"));
  writeFileSync(join(scripts, "run.sh"), "#!/bin/sh\nexit 0\n");
  writeFileSync(join(scripts, "fetch-binary.sh"), "#!/bin/sh\nexit 0\n");
  chmodSync(join(scripts, "install.sh"), 0o755);
  chmodSync(join(scripts, "run.sh"), 0o755);
  chmodSync(join(scripts, "fetch-binary.sh"), 0o755);
  return { home, scripts };
}

async function install(agent: "claude" | "codex" | "gemini") {
  const { home, scripts } = fixture();
  const proc = Bun.spawn([join(scripts, "install.sh"), "--agent", agent], {
    env: { ...process.env, HOME: home },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  expect(stderr).toBe("");
  expect(exitCode).toBe(0);
  return { home, scripts, stdout };
}

async function installAuto(configDirs: string[]) {
  const { home, scripts } = fixture();
  for (const configDir of configDirs) {
    mkdirSync(join(home, configDir), { recursive: true });
  }
  const proc = Bun.spawn([join(scripts, "install.sh")], {
    env: { ...process.env, HOME: home },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stderr, exitCode] = await Promise.all([
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  expect(stderr).toBe("");
  expect(exitCode).toBe(0);
  return home;
}

describe("install.sh host isolation", () => {
  test("Codex writes hooks.json with only the apply_patch matcher", async () => {
    const { home, scripts, stdout } = await install("codex");
    const target = join(home, ".codex", "hooks.json");
    const config = JSON.parse(readFileSync(target, "utf8"));

    expect(config.hooks.PostToolUse).toEqual([
      {
        matcher: "apply_patch",
        hooks: [{ type: "command", command: join(scripts, "run.sh") }],
      },
    ]);
    expect(stdout).toContain("Review and trust the new command hook with /hooks");
    expect(existsSync(join(home, ".claude"))).toBe(false);
    expect(existsSync(join(home, ".gemini"))).toBe(false);
  });

  test.each([
    ["claude", ".claude", "PostToolUse", "Edit|Write|MultiEdit|NotebookEdit"],
    ["gemini", ".gemini", "AfterTool", "replace|write_file"],
  ] as const)(
    "%s keeps its existing settings path and matcher",
    async (agent, configDir, event, matcher) => {
      const { home } = await install(agent);
      const target = join(home, configDir, "settings.json");
      const config = JSON.parse(readFileSync(target, "utf8"));
      expect(config.hooks[event][0].matcher).toBe(matcher);
      expect(existsSync(join(home, ".codex"))).toBe(false);
    },
  );

  test("auto-detects Codex when it is the sole configured host", async () => {
    const home = await installAuto([".codex"]);
    expect(existsSync(join(home, ".codex", "hooks.json"))).toBe(true);
    expect(existsSync(join(home, ".claude"))).toBe(false);
    expect(existsSync(join(home, ".gemini"))).toBe(false);
  });

  test("preserves Gemini precedence and Claude precedence when configured", async () => {
    const geminiHome = await installAuto([".gemini"]);
    expect(existsSync(join(geminiHome, ".gemini", "settings.json"))).toBe(true);

    const ambiguousHome = await installAuto([".codex", ".gemini"]);
    expect(existsSync(join(ambiguousHome, ".gemini", "settings.json"))).toBe(true);
    expect(existsSync(join(ambiguousHome, ".codex", "hooks.json"))).toBe(false);

    const claudeHome = await installAuto([".claude", ".codex", ".gemini"]);
    expect(existsSync(join(claudeHome, ".claude", "settings.json"))).toBe(true);
    expect(existsSync(join(claudeHome, ".codex", "hooks.json"))).toBe(false);
    expect(existsSync(join(claudeHome, ".gemini", "settings.json"))).toBe(false);
  });
});
