import { test, expect } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPTS = join(import.meta.dir, "..", "scripts");
const LACONIC = join(SCRIPTS, "laconic.sh");
const HOOK = join(SCRIPTS, "session-start.sh");
const INSTALL = join(SCRIPTS, "install.sh");
const UNINSTALL = join(SCRIPTS, "uninstall.sh");

// Each test gets its own isolated user-config and project dir so state files
// never leak between cases or touch the real ~/.claude.
function fresh() {
  const userDir = mkdtempSync(join(tmpdir(), "laconic-user-"));
  const projDir = mkdtempSync(join(tmpdir(), "laconic-proj-"));
  const vars = {
    ...process.env,
    CLAUDE_CONFIG_DIR: userDir,
    CLAUDE_PROJECT_DIR: projDir,
  } as Record<string, string>;
  return { userDir, projDir, vars };
}

function laconic(args: string[], vars: Record<string, string>) {
  const p = Bun.spawnSync(["bash", LACONIC, ...args], { env: vars });
  return { code: p.exitCode, out: p.stdout.toString(), err: p.stderr.toString() };
}

function runHook(vars: Record<string, string>, cwd: string) {
  const p = Bun.spawnSync(["bash", HOOK], {
    env: vars,
    stdin: Buffer.from(JSON.stringify({ cwd, hook_event_name: "SessionStart" })),
  });
  return { code: p.exitCode, out: p.stdout.toString() };
}

test("on --user writes state and status resolves the user scope", () => {
  const { userDir, vars } = fresh();
  laconic(["on", "--user", "prose-only"], vars);
  expect(readFileSync(join(userDir, "laconic.state"), "utf8").trim()).toBe("on prose-only");
  const s = laconic(["status"], vars);
  expect(s.out).toContain("on (mode: prose-only)");
  expect(s.out).toContain("user scope");
});

test("on defaults to prose+code", () => {
  const { userDir, vars } = fresh();
  laconic(["on", "--user"], vars);
  expect(readFileSync(join(userDir, "laconic.state"), "utf8").trim()).toBe("on prose+code");
});

test("a project off overrides a user on", () => {
  const { vars } = fresh();
  laconic(["on", "--user"], vars);
  laconic(["off", "--project"], vars);
  const s = laconic(["status"], vars);
  expect(s.out).toContain("off");
  expect(s.out).toContain("project scope");
});

test("mode changes the mode and keeps the on/off state", () => {
  const { userDir, vars } = fresh();
  laconic(["on", "--user", "prose+code"], vars);
  laconic(["mode", "prose-only", "--user"], vars);
  expect(readFileSync(join(userDir, "laconic.state"), "utf8").trim()).toBe("on prose-only");
});

test("statusline emits a badge when on, nothing when off/unset", () => {
  const { vars } = fresh();
  expect(laconic(["statusline"], vars).out).toBe(""); // unset
  laconic(["on", "--user", "prose+code"], vars);
  expect(laconic(["statusline"], vars).out).toBe("◆ laconic");
  laconic(["mode", "prose-only", "--user"], vars);
  expect(laconic(["statusline"], vars).out).toBe("◆ laconic"); // badge is mode-agnostic
  laconic(["off", "--user"], vars);
  expect(laconic(["statusline"], vars).out).toBe("");
});

test("statusline honours project-over-user precedence", () => {
  const { vars } = fresh();
  laconic(["on", "--user"], vars);
  laconic(["off", "--project"], vars);
  expect(laconic(["statusline"], vars).out).toBe(""); // project off wins
});

test("hook injects only the active mode block (prose-only)", () => {
  const { vars, projDir } = fresh();
  laconic(["on", "--user", "prose-only"], vars);
  const r = runHook(vars, projDir);
  expect(r.code).toBe(0);
  expect(r.out).toContain("LACONIC MODE ACTIVE (mode: prose-only)");
  expect(r.out).toContain("Scope: prose-only");
  expect(r.out).not.toContain("Scope: prose + code");
});

test("hook injects the prose+code block in prose+code mode", () => {
  const { vars, projDir } = fresh();
  laconic(["on", "--user", "prose+code"], vars);
  const r = runHook(vars, projDir);
  expect(r.out).toContain("Scope: prose + code");
  expect(r.out).not.toContain("Scope: prose-only");
});

test("hook is silent when unset and when off", () => {
  const { vars, projDir } = fresh();
  const unset = runHook(vars, projDir);
  expect(unset.code).toBe(0);
  expect(unset.out.trim()).toBe("");
  laconic(["off", "--user"], vars);
  expect(runHook(vars, projDir).out.trim()).toBe("");
});

test("hook picks up project-scope state via the cwd payload", () => {
  const { vars, projDir } = fresh();
  laconic(["on", "--project", "prose+code"], vars);
  const r = runHook(vars, projDir);
  expect(r.out).toContain("LACONIC MODE ACTIVE");
});

test("install.sh wires the SessionStart hook idempotently", () => {
  if (!Bun.which("jq")) return; // requires jq; skip when unavailable
  const { vars } = fresh();
  const target = join(mkdtempSync(join(tmpdir(), "laconic-set-")), "settings.json");
  const first = Bun.spawnSync(["bash", INSTALL, "--target", target], { env: vars });
  expect(first.exitCode).toBe(0);
  const cfg = JSON.parse(readFileSync(target, "utf8"));
  const cmds = cfg.hooks.SessionStart.flatMap((e: any) => e.hooks.map((h: any) => h.command));
  expect(cmds.some((c: string) => c.endsWith("session-start.sh"))).toBe(true);
  const second = Bun.spawnSync(["bash", INSTALL, "--target", target], { env: vars });
  expect(second.stdout.toString()).toContain("already wired");
  const cfg2 = JSON.parse(readFileSync(target, "utf8"));
  expect(cfg2.hooks.SessionStart.length).toBe(1);
});

test("uninstall.sh reverses install and deletes the scope's state", () => {
  if (!Bun.which("jq")) return; // requires jq; skip when unavailable
  const setDir = mkdtempSync(join(tmpdir(), "laconic-set-"));
  const target = join(setDir, "settings.json");
  const state = join(setDir, "laconic.state");
  const vars = { ...process.env } as Record<string, string>;

  Bun.spawnSync(["bash", INSTALL, "--target", target], { env: vars });
  writeFileSync(state, "on prose+code\n");
  const r = Bun.spawnSync(["bash", UNINSTALL, "--target", target], { env: vars });
  expect(r.exitCode).toBe(0);
  const cfg = JSON.parse(readFileSync(target, "utf8"));
  // The empty SessionStart array (and empty hooks object) get pruned away.
  const cmds = (cfg.hooks?.SessionStart ?? []).flatMap((e: any) =>
    e.hooks.map((h: any) => h.command),
  );
  expect(cmds.some((c: string) => c.includes("session-start.sh"))).toBe(false);
  expect(existsSync(state)).toBe(false);

  // Idempotent: a second run is a clean no-op.
  const again = Bun.spawnSync(["bash", UNINSTALL, "--target", target], { env: vars });
  expect(again.exitCode).toBe(0);
  expect(again.stdout.toString()).toContain("Nothing to do");
});

test("uninstall.sh leaves co-existing hooks and honours --keep-state", () => {
  if (!Bun.which("jq")) return; // requires jq; skip when unavailable
  const setDir = mkdtempSync(join(tmpdir(), "laconic-set-"));
  const target = join(setDir, "settings.json");
  const state = join(setDir, "laconic.state");
  const vars = { ...process.env } as Record<string, string>;

  // A pre-existing, unrelated SessionStart hook that must survive.
  writeFileSync(
    target,
    JSON.stringify({
      hooks: {
        SessionStart: [
          { matcher: "startup", hooks: [{ type: "command", command: "/x/other.sh" }] },
        ],
      },
    }),
  );
  Bun.spawnSync(["bash", INSTALL, "--target", target], { env: vars });
  writeFileSync(state, "on prose+code\n");

  const r = Bun.spawnSync(["bash", UNINSTALL, "--target", target, "--keep-state"], { env: vars });
  expect(r.exitCode).toBe(0);
  const cfg = JSON.parse(readFileSync(target, "utf8"));
  const cmds = cfg.hooks.SessionStart.flatMap((e: any) => e.hooks.map((h: any) => h.command));
  expect(cmds).toContain("/x/other.sh");
  expect(cmds.some((c: string) => c.includes("session-start.sh"))).toBe(false);
  expect(existsSync(state)).toBe(true); // --keep-state preserved it
});
