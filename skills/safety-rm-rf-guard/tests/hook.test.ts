import { describe, test, expect } from "bun:test";
import { spawn } from "bun";
import { join } from "path";

const HOOK_PATH = join(import.meta.dir, "..", "scripts", "index.ts");

async function runHook(
  command: string
): Promise<{ exitCode: number; stderr: string }> {
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
  const stderr = await new Response(proc.stderr).text();

  return { exitCode, stderr };
}

describe("Commands that SHOULD be blocked", () => {
  test("rm file.txt", async () => {
    const { exitCode, stderr } = await runHook("rm file.txt");
    expect(exitCode).toBe(2);
    expect(stderr).toContain("BLOCKED");
  });

  test("rm -rf directory/", async () => {
    const { exitCode, stderr } = await runHook("rm -rf directory/");
    expect(exitCode).toBe(2);
    expect(stderr).toContain("BLOCKED");
  });

  test("rm -f *.log", async () => {
    const { exitCode, stderr } = await runHook("rm -f *.log");
    expect(exitCode).toBe(2);
    expect(stderr).toContain("BLOCKED");
  });

  test("sudo rm file", async () => {
    const { exitCode, stderr } = await runHook("sudo rm file");
    expect(exitCode).toBe(2);
    expect(stderr).toContain("BLOCKED");
  });

  test("cmd && rm file", async () => {
    const { exitCode, stderr } = await runHook("ls && rm file");
    expect(exitCode).toBe(2);
    expect(stderr).toContain("BLOCKED");
  });

  test("cmd || rm file", async () => {
    const { exitCode, stderr } = await runHook("ls || rm file");
    expect(exitCode).toBe(2);
    expect(stderr).toContain("BLOCKED");
  });

  test("cmd ; rm file", async () => {
    const { exitCode, stderr } = await runHook("ls ; rm file");
    expect(exitCode).toBe(2);
    expect(stderr).toContain("BLOCKED");
  });

  test("cmd | xargs rm", async () => {
    const { exitCode, stderr } = await runHook("find . | xargs rm");
    expect(exitCode).toBe(2);
    expect(stderr).toContain("BLOCKED");
  });

  test("shred secret.txt", async () => {
    const { exitCode, stderr } = await runHook("shred secret.txt");
    expect(exitCode).toBe(2);
    expect(stderr).toContain("BLOCKED");
  });

  test("unlink file", async () => {
    const { exitCode, stderr } = await runHook("unlink file");
    expect(exitCode).toBe(2);
    expect(stderr).toContain("BLOCKED");
  });
});

describe("Commands that SHOULD be allowed", () => {
  test("git rm file.ts", async () => {
    const { exitCode } = await runHook("git rm file.ts");
    expect(exitCode).toBe(0);
  });

  test("ls -la", async () => {
    const { exitCode } = await runHook("ls -la");
    expect(exitCode).toBe(0);
  });

  test("cat README.md", async () => {
    const { exitCode } = await runHook("cat README.md");
    expect(exitCode).toBe(0);
  });

  test("npm install", async () => {
    const { exitCode } = await runHook("npm install");
    expect(exitCode).toBe(0);
  });

  test("pnpm remove package", async () => {
    const { exitCode } = await runHook("pnpm remove package");
    expect(exitCode).toBe(0);
  });

  test("echo 'rm test' (quoted)", async () => {
    const { exitCode } = await runHook("echo 'rm test'");
    expect(exitCode).toBe(0);
  });

  test('echo "rm test" (double quoted)', async () => {
    const { exitCode } = await runHook('echo "rm test"');
    expect(exitCode).toBe(0);
  });

  test("git commit -m 'rm old files'", async () => {
    const { exitCode } = await runHook("git commit -m 'rm old files'");
    expect(exitCode).toBe(0);
  });

  test("grep 'rm' file.txt", async () => {
    const { exitCode } = await runHook("grep 'rm' file.txt");
    expect(exitCode).toBe(0);
  });
});

describe("Bypass patterns that SHOULD be blocked", () => {
  test("/bin/rm file.txt (absolute path)", async () => {
    const { exitCode } = await runHook("/bin/rm file.txt");
    expect(exitCode).toBe(2);
  });

  test("/usr/bin/rm -rf dir/ (absolute path)", async () => {
    const { exitCode } = await runHook("/usr/bin/rm -rf dir/");
    expect(exitCode).toBe(2);
  });

  test("./rm file (relative path)", async () => {
    const { exitCode } = await runHook("./rm file");
    expect(exitCode).toBe(2);
  });

  test("sh -c 'rm file.txt' (subshell)", async () => {
    const { exitCode } = await runHook("sh -c 'rm file.txt'");
    expect(exitCode).toBe(2);
  });

  test("bash -c 'rm -rf dir/' (subshell)", async () => {
    const { exitCode } = await runHook("bash -c 'rm -rf dir/'");
    expect(exitCode).toBe(2);
  });

  test("command rm file.txt (builtin bypass)", async () => {
    const { exitCode } = await runHook("command rm file.txt");
    expect(exitCode).toBe(2);
  });

  test("env rm file.txt (env bypass)", async () => {
    const { exitCode } = await runHook("env rm file.txt");
    expect(exitCode).toBe(2);
  });

  test("\\rm file.txt (backslash escape)", async () => {
    const { exitCode } = await runHook("\\rm file.txt");
    expect(exitCode).toBe(2);
  });

  test("find . -delete", async () => {
    const { exitCode } = await runHook("find . -delete");
    expect(exitCode).toBe(2);
  });

  test("find . -name '*.log' -delete", async () => {
    const { exitCode } = await runHook("find . -name '*.log' -delete");
    expect(exitCode).toBe(2);
  });

  test("find . -exec rm {} \\;", async () => {
    const { exitCode } = await runHook("find . -exec rm {} \\;");
    expect(exitCode).toBe(2);
  });

  test("sudo /bin/rm file", async () => {
    const { exitCode } = await runHook("sudo /bin/rm file");
    expect(exitCode).toBe(2);
  });

  test("xargs /bin/rm", async () => {
    const { exitCode } = await runHook("find . | xargs /bin/rm");
    expect(exitCode).toBe(2);
  });
});

describe("Edge cases", () => {
  test("empty command", async () => {
    const { exitCode } = await runHook("");
    expect(exitCode).toBe(0);
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
