import { test, expect } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPTS = join(import.meta.dir, "..", "scripts");
const LACONIC = join(SCRIPTS, "laconic.sh");
const HOOK = join(SCRIPTS, "session-start.sh");
const REMINDER = join(SCRIPTS, "prompt-reminder.sh");
const INSTALL = join(SCRIPTS, "install.sh");
const UNINSTALL = join(SCRIPTS, "uninstall.sh");

// A distinctive custom status line to wrap: echoes a marker plus the model name
// read from the JSON payload, so we can prove the original still runs.
const CUSTOM_STATUSLINE =
  "python3 -c \"import sys,json; d=json.load(sys.stdin); print('CUSTOM', d.get('model',{}).get('display_name',''))\"";

// Run a resolved .statusLine.command string with a JSON payload on stdin.
function runStatusline(command: string, payload: object, vars: Record<string, string>) {
  const p = Bun.spawnSync(["bash", "-c", command], {
    env: vars,
    stdin: Buffer.from(JSON.stringify(payload)),
  });
  return p.stdout.toString();
}

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

test("on --user laconic-code writes state and status resolves it", () => {
  const { userDir, vars } = fresh();
  laconic(["on", "--user", "laconic-code"], vars);
  expect(readFileSync(join(userDir, "laconic.state"), "utf8").trim()).toBe("on laconic-code");
  expect(laconic(["status"], vars).out).toContain("on (mode: laconic-code)");
});

test("mode laconic-code is accepted and switches from a prose mode", () => {
  const { userDir, vars } = fresh();
  laconic(["on", "--user", "prose+code"], vars);
  laconic(["mode", "laconic-code", "--user"], vars);
  expect(readFileSync(join(userDir, "laconic.state"), "utf8").trim()).toBe("on laconic-code");
});

test("hook injects only the code-first block in laconic-code mode", () => {
  const { vars, projDir } = fresh();
  laconic(["on", "--user", "laconic-code"], vars);
  const r = runHook(vars, projDir);
  expect(r.out).toContain("LACONIC MODE ACTIVE (mode: laconic-code)");
  expect(r.out).toContain("Scope: code-first");
  expect(r.out).not.toContain("Scope: prose-only");
  expect(r.out).not.toContain("Scope: prose + code");
  // Code-first examples show; the prose-only/prose+code examples are gated out.
  expect(r.out).toContain("Explaining a bug");
  expect(r.out).not.toContain("**Cutting asides**");
  // The risk warning is mode-agnostic and always injected.
  expect(r.out).toContain("Warning before something irreversible");
});

test("prose modes keep the prose examples and hide the code-first ones", () => {
  const { vars, projDir } = fresh();
  laconic(["on", "--user", "prose+code"], vars);
  const r = runHook(vars, projDir);
  expect(r.out).toContain("**Cutting asides**");
  expect(r.out).not.toContain("Explaining a bug");
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

test("install.sh wraps an existing status line and the wrapper composes original + badge", () => {
  if (!Bun.which("jq")) return;
  const setDir = mkdtempSync(join(tmpdir(), "laconic-set-"));
  const target = join(setDir, "settings.json");
  const vars = { ...process.env, CLAUDE_CONFIG_DIR: setDir } as Record<string, string>;
  writeFileSync(target, JSON.stringify({ statusLine: { type: "command", command: CUSTOM_STATUSLINE } }));

  const r = Bun.spawnSync(["bash", INSTALL, "--target", target], { env: vars });
  expect(r.exitCode).toBe(0);

  // Original saved verbatim; command now routes through the wrapper.
  const cfg = JSON.parse(readFileSync(target, "utf8"));
  expect(cfg.statusLine.command).toContain("statusline.sh");
  const saved = JSON.parse(readFileSync(join(setDir, "laconic.statusline.orig.json"), "utf8"));
  expect(saved.command).toBe(CUSTOM_STATUSLINE);

  const payload = { model: { display_name: "Opus 4.8" }, workspace: { current_dir: setDir } };
  // Off: just the original. (No state file yet → unset → off.)
  expect(runStatusline(cfg.statusLine.command, payload, vars).trim()).toBe("CUSTOM Opus 4.8");
  // On: original + badge.
  writeFileSync(join(setDir, "laconic.state"), "on prose+code\n");
  expect(runStatusline(cfg.statusLine.command, payload, vars).trim()).toBe("CUSTOM Opus 4.8  ◆ laconic");
});

test("install.sh with no existing status line yields a badge-only wrapper", () => {
  if (!Bun.which("jq")) return;
  const setDir = mkdtempSync(join(tmpdir(), "laconic-set-"));
  const target = join(setDir, "settings.json");
  const vars = { ...process.env, CLAUDE_CONFIG_DIR: setDir } as Record<string, string>;

  Bun.spawnSync(["bash", INSTALL, "--target", target], { env: vars });
  const saved = JSON.parse(readFileSync(join(setDir, "laconic.statusline.orig.json"), "utf8"));
  expect(saved).toBeNull(); // nothing to restore later

  const cfg = JSON.parse(readFileSync(target, "utf8"));
  writeFileSync(join(setDir, "laconic.state"), "on prose+code\n");
  const out = runStatusline(cfg.statusLine.command, { workspace: { current_dir: setDir } }, vars);
  expect(out.trim()).toBe("◆ laconic");
});

test("install.sh --no-statusline wires the hook only", () => {
  if (!Bun.which("jq")) return;
  const setDir = mkdtempSync(join(tmpdir(), "laconic-set-"));
  const target = join(setDir, "settings.json");
  const vars = { ...process.env } as Record<string, string>;
  Bun.spawnSync(["bash", INSTALL, "--target", target, "--no-statusline"], { env: vars });
  const cfg = JSON.parse(readFileSync(target, "utf8"));
  expect(cfg.statusLine).toBeUndefined();
  expect(existsSync(join(setDir, "laconic.statusline.orig.json"))).toBe(false);
});

test("status-line wiring is idempotent — a re-run never re-saves the wrapper as the original", () => {
  if (!Bun.which("jq")) return;
  const setDir = mkdtempSync(join(tmpdir(), "laconic-set-"));
  const target = join(setDir, "settings.json");
  const vars = { ...process.env } as Record<string, string>;
  writeFileSync(target, JSON.stringify({ statusLine: { type: "command", command: CUSTOM_STATUSLINE } }));

  Bun.spawnSync(["bash", INSTALL, "--target", target], { env: vars });
  const orig1 = readFileSync(join(setDir, "laconic.statusline.orig.json"), "utf8");
  const second = Bun.spawnSync(["bash", INSTALL, "--target", target], { env: vars });
  expect(second.stdout.toString()).toContain("badge already wired");
  const orig2 = readFileSync(join(setDir, "laconic.statusline.orig.json"), "utf8");
  expect(orig2).toBe(orig1);
  expect(JSON.parse(orig2).command).toBe(CUSTOM_STATUSLINE); // not the wrapper
});

test("uninstall.sh restores the wrapped status line verbatim", () => {
  if (!Bun.which("jq")) return;
  const setDir = mkdtempSync(join(tmpdir(), "laconic-set-"));
  const target = join(setDir, "settings.json");
  const vars = { ...process.env } as Record<string, string>;
  writeFileSync(target, JSON.stringify({ statusLine: { type: "command", command: CUSTOM_STATUSLINE } }));

  Bun.spawnSync(["bash", INSTALL, "--target", target], { env: vars });
  Bun.spawnSync(["bash", UNINSTALL, "--target", target], { env: vars });

  const cfg = JSON.parse(readFileSync(target, "utf8"));
  expect(cfg.statusLine.command).toBe(CUSTOM_STATUSLINE);
  expect(existsSync(join(setDir, "laconic.statusline.orig.json"))).toBe(false);
});

test("uninstall.sh --statusline-only restores the status line but keeps hook + state", () => {
  if (!Bun.which("jq")) return;
  const setDir = mkdtempSync(join(tmpdir(), "laconic-set-"));
  const target = join(setDir, "settings.json");
  const state = join(setDir, "laconic.state");
  const vars = { ...process.env } as Record<string, string>;
  writeFileSync(target, JSON.stringify({ statusLine: { type: "command", command: CUSTOM_STATUSLINE } }));

  Bun.spawnSync(["bash", INSTALL, "--target", target], { env: vars });
  writeFileSync(state, "on prose+code\n");
  Bun.spawnSync(["bash", UNINSTALL, "--target", target, "--statusline-only"], { env: vars });

  const cfg = JSON.parse(readFileSync(target, "utf8"));
  expect(cfg.statusLine.command).toBe(CUSTOM_STATUSLINE); // restored
  const cmds = cfg.hooks.SessionStart.flatMap((e: any) => e.hooks.map((h: any) => h.command));
  expect(cmds.some((c: string) => c.includes("session-start.sh"))).toBe(true); // hook kept
  expect(existsSync(state)).toBe(true); // state kept
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

// --- UserPromptSubmit reminder + cadence -----------------------------------

// Run the per-turn reminder hook with a UserPromptSubmit payload. Omit
// sessionId to exercise the no-counter fallback path.
function runReminder(vars: Record<string, string>, cwd: string, sessionId?: string) {
  const payload: Record<string, unknown> = { cwd, hook_event_name: "UserPromptSubmit" };
  if (sessionId) payload.session_id = sessionId;
  const p = Bun.spawnSync(["bash", REMINDER], { env: vars, stdin: Buffer.from(JSON.stringify(payload)) });
  return { code: p.exitCode, out: p.stdout.toString() };
}

test("reminder hook is silent when unset and when off", () => {
  const { vars, projDir } = fresh();
  expect(runReminder(vars, projDir, "s").out).toBe(""); // unset
  laconic(["off", "--user"], vars);
  expect(runReminder(vars, projDir, "s").out).toBe(""); // explicit off
});

test("reminder emits every turn at the default cadence and names the active mode", () => {
  const { vars, projDir } = fresh();
  laconic(["on", "--user", "laconic-code"], vars);
  for (let t = 0; t < 3; t++) {
    expect(runReminder(vars, projDir, "sess-default").out).toContain(
      "Reminder to follow the laconic-code laconic rules",
    );
  }
});

test("cadence writes its own file and status reports it", () => {
  const { userDir, vars } = fresh();
  laconic(["on", "--user"], vars);
  const c = laconic(["cadence", "3", "--user"], vars);
  expect(c.code).toBe(0);
  expect(readFileSync(join(userDir, "laconic.cadence"), "utf8").trim()).toBe("3");
  expect(laconic(["status"], vars).out).toContain("reminder cadence: every 3 turn(s)");
});

test("cadence N gates the reminder to turns 1, 1+N, 1+2N", () => {
  const { vars, projDir } = fresh();
  vars.TMPDIR = mkdtempSync(join(tmpdir(), "laconic-tmpdir-")); // isolate the turn counter
  laconic(["on", "--user", "prose+code"], vars);
  laconic(["cadence", "3", "--user"], vars);
  const emitted: number[] = [];
  for (let turn = 1; turn <= 7; turn++) {
    if (runReminder(vars, projDir, "sess-3").out !== "") emitted.push(turn);
  }
  expect(emitted).toEqual([1, 4, 7]);
});

test("cadence rejects zero, non-numeric, and missing values", () => {
  const { vars } = fresh();
  expect(laconic(["cadence", "0", "--user"], vars).code).toBe(2);
  expect(laconic(["cadence", "abc", "--user"], vars).code).toBe(2);
  expect(laconic(["cadence", "--user"], vars).code).toBe(2);
});

test("reminder falls back to every turn when the payload has no session_id", () => {
  const { vars, projDir } = fresh();
  vars.TMPDIR = mkdtempSync(join(tmpdir(), "laconic-tmpdir-"));
  laconic(["on", "--user"], vars);
  laconic(["cadence", "5", "--user"], vars);
  // Can't count without a session id, so remind every turn rather than go silent.
  expect(runReminder(vars, projDir).out).not.toBe("");
  expect(runReminder(vars, projDir).out).not.toBe("");
});

test("cadence resolves project-over-user", () => {
  const { vars } = fresh();
  laconic(["on", "--user"], vars);
  laconic(["cadence", "5", "--user"], vars);
  laconic(["cadence", "2", "--project"], vars);
  expect(laconic(["status"], vars).out).toContain("reminder cadence: every 2 turn(s)");
});

test("install wires the UserPromptSubmit reminder with no matcher; uninstall removes it and the cadence file", () => {
  if (!Bun.which("jq")) return; // requires jq; skip when unavailable
  const setDir = mkdtempSync(join(tmpdir(), "laconic-set-"));
  const target = join(setDir, "settings.json");
  const vars = { ...process.env } as Record<string, string>;

  Bun.spawnSync(["bash", INSTALL, "--target", target], { env: vars });
  const cfg = JSON.parse(readFileSync(target, "utf8"));
  const ups = cfg.hooks.UserPromptSubmit;
  const cmds = ups.flatMap((e: any) => e.hooks.map((h: any) => h.command));
  expect(cmds.some((c: string) => c.endsWith("prompt-reminder.sh"))).toBe(true);
  expect(ups.every((e: any) => !("matcher" in e))).toBe(true); // UserPromptSubmit takes no matcher

  writeFileSync(join(setDir, "laconic.state"), "on prose+code\n");
  writeFileSync(join(setDir, "laconic.cadence"), "3\n");
  Bun.spawnSync(["bash", UNINSTALL, "--target", target], { env: vars });
  const cfg2 = JSON.parse(readFileSync(target, "utf8"));
  const cmds2 = (cfg2.hooks?.UserPromptSubmit ?? []).flatMap((e: any) =>
    e.hooks.map((h: any) => h.command),
  );
  expect(cmds2.some((c: string) => c.includes("prompt-reminder.sh"))).toBe(false);
  expect(existsSync(join(setDir, "laconic.cadence"))).toBe(false);
});
