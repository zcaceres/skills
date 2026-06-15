import { describe, test, expect } from "bun:test";
import { spawn } from "bun";
import { join } from "path";

const HOOK_PATH = join(import.meta.dir, "..", "scripts", "index.ts");

// The hook blocks via the PreToolUse JSON contract on stdout + exit 0 (the
// shape Claude Code and Codex both honor), not via exit code 2. A blocked
// command prints {"hookSpecificOutput":{"permissionDecision":"deny",...}};
// an allowed command prints nothing.
async function runHook(command: string): Promise<{
  exitCode: number;
  decision: string | null;
  reason: string | null;
}> {
  const input = JSON.stringify({ tool_input: { command } });

  const proc = spawn({
    cmd: ["bun", "run", HOOK_PATH],
    stdin: "pipe",
    stderr: "pipe",
    stdout: "pipe",
  });

  proc.stdin.write(input);
  proc.stdin.end();

  const exitCode = await proc.exited;
  const stdout = await new Response(proc.stdout).text();

  let decision: string | null = null;
  let reason: string | null = null;
  const trimmed = stdout.trim();
  if (trimmed) {
    const parsed = JSON.parse(trimmed);
    decision = parsed?.hookSpecificOutput?.permissionDecision ?? null;
    reason = parsed?.hookSpecificOutput?.permissionDecisionReason ?? null;
  }

  return { exitCode, decision, reason };
}

describe("Commands that SHOULD be blocked", () => {
  test("rm file.txt", async () => {
    const { exitCode, decision, reason } = await runHook("rm file.txt");
    expect(exitCode).toBe(0);
    expect(decision).toBe("deny");
    expect(reason).toContain("BLOCKED");
  });

  test("rm -rf directory/", async () => {
    const { exitCode, decision, reason } = await runHook("rm -rf directory/");
    expect(exitCode).toBe(0);
    expect(decision).toBe("deny");
    expect(reason).toContain("BLOCKED");
  });

  test("rm -f *.log", async () => {
    const { exitCode, decision, reason } = await runHook("rm -f *.log");
    expect(exitCode).toBe(0);
    expect(decision).toBe("deny");
    expect(reason).toContain("BLOCKED");
  });

  test("sudo rm file", async () => {
    const { exitCode, decision, reason } = await runHook("sudo rm file");
    expect(exitCode).toBe(0);
    expect(decision).toBe("deny");
    expect(reason).toContain("BLOCKED");
  });

  test("cmd && rm file", async () => {
    const { exitCode, decision } = await runHook("ls && rm file");
    expect(exitCode).toBe(0);
    expect(decision).toBe("deny");
  });

  test("cmd || rm file", async () => {
    const { exitCode, decision } = await runHook("ls || rm file");
    expect(exitCode).toBe(0);
    expect(decision).toBe("deny");
  });

  test("cmd ; rm file", async () => {
    const { exitCode, decision } = await runHook("ls ; rm file");
    expect(exitCode).toBe(0);
    expect(decision).toBe("deny");
  });

  test("cmd | xargs rm", async () => {
    const { exitCode, decision } = await runHook("find . | xargs rm");
    expect(exitCode).toBe(0);
    expect(decision).toBe("deny");
  });

  test("shred secret.txt", async () => {
    const { exitCode, decision } = await runHook("shred secret.txt");
    expect(exitCode).toBe(0);
    expect(decision).toBe("deny");
  });

  test("unlink file", async () => {
    const { exitCode, decision } = await runHook("unlink file");
    expect(exitCode).toBe(0);
    expect(decision).toBe("deny");
  });
});

describe("Commands that SHOULD be allowed", () => {
  test("git rm file.ts", async () => {
    const { exitCode, decision } = await runHook("git rm file.ts");
    expect(exitCode).toBe(0);
    expect(decision).toBeNull();
  });

  test("ls -la", async () => {
    const { exitCode, decision } = await runHook("ls -la");
    expect(exitCode).toBe(0);
    expect(decision).toBeNull();
  });

  test("cat README.md", async () => {
    const { exitCode, decision } = await runHook("cat README.md");
    expect(exitCode).toBe(0);
    expect(decision).toBeNull();
  });

  test("npm install", async () => {
    const { exitCode, decision } = await runHook("npm install");
    expect(exitCode).toBe(0);
    expect(decision).toBeNull();
  });

  test("pnpm remove package", async () => {
    const { exitCode, decision } = await runHook("pnpm remove package");
    expect(exitCode).toBe(0);
    expect(decision).toBeNull();
  });

  test("echo 'rm test' (quoted)", async () => {
    const { exitCode, decision } = await runHook("echo 'rm test'");
    expect(exitCode).toBe(0);
    expect(decision).toBeNull();
  });

  test('echo "rm test" (double quoted)', async () => {
    const { exitCode, decision } = await runHook('echo "rm test"');
    expect(exitCode).toBe(0);
    expect(decision).toBeNull();
  });

  test("git commit -m 'rm old files'", async () => {
    const { exitCode, decision } = await runHook("git commit -m 'rm old files'");
    expect(exitCode).toBe(0);
    expect(decision).toBeNull();
  });

  test("grep 'rm' file.txt", async () => {
    const { exitCode, decision } = await runHook("grep 'rm' file.txt");
    expect(exitCode).toBe(0);
    expect(decision).toBeNull();
  });
});

describe("Bypass patterns that SHOULD be blocked", () => {
  test("/bin/rm file.txt (absolute path)", async () => {
    const { decision } = await runHook("/bin/rm file.txt");
    expect(decision).toBe("deny");
  });

  test("/usr/bin/rm -rf dir/ (absolute path)", async () => {
    const { decision } = await runHook("/usr/bin/rm -rf dir/");
    expect(decision).toBe("deny");
  });

  test("./rm file (relative path)", async () => {
    const { decision } = await runHook("./rm file");
    expect(decision).toBe("deny");
  });

  test("sh -c 'rm file.txt' (subshell)", async () => {
    const { decision } = await runHook("sh -c 'rm file.txt'");
    expect(decision).toBe("deny");
  });

  test("bash -c 'rm -rf dir/' (subshell)", async () => {
    const { decision } = await runHook("bash -c 'rm -rf dir/'");
    expect(decision).toBe("deny");
  });

  test("command rm file.txt (builtin bypass)", async () => {
    const { decision } = await runHook("command rm file.txt");
    expect(decision).toBe("deny");
  });

  test("env rm file.txt (env bypass)", async () => {
    const { decision } = await runHook("env rm file.txt");
    expect(decision).toBe("deny");
  });

  test("\\rm file.txt (backslash escape)", async () => {
    const { decision } = await runHook("\\rm file.txt");
    expect(decision).toBe("deny");
  });

  test("find . -delete", async () => {
    const { decision } = await runHook("find . -delete");
    expect(decision).toBe("deny");
  });

  test("find . -name '*.log' -delete", async () => {
    const { decision } = await runHook("find . -name '*.log' -delete");
    expect(decision).toBe("deny");
  });

  test("find . -exec rm {} \\;", async () => {
    const { decision } = await runHook("find . -exec rm {} \\;");
    expect(decision).toBe("deny");
  });

  test("sudo /bin/rm file", async () => {
    const { decision } = await runHook("sudo /bin/rm file");
    expect(decision).toBe("deny");
  });

  test("xargs /bin/rm", async () => {
    const { decision } = await runHook("find . | xargs /bin/rm");
    expect(decision).toBe("deny");
  });
});

describe("Edge cases", () => {
  test("empty command", async () => {
    const { exitCode, decision } = await runHook("");
    expect(exitCode).toBe(0);
    expect(decision).toBeNull();
  });

  test("invalid JSON input exits 0", async () => {
    const proc = spawn({
      cmd: ["bun", "run", HOOK_PATH],
      stdin: "pipe",
      stderr: "pipe",
      stdout: "pipe",
    });

    proc.stdin.write("not valid json");
    proc.stdin.end();

    const exitCode = await proc.exited;
    expect(exitCode).toBe(0);
  });
});
