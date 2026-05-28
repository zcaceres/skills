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
  test("git reset --hard", async () => {
    const { exitCode, stderr } = await runHook("git reset --hard");
    expect(exitCode).toBe(2);
    expect(stderr).toContain("BLOCKED");
  });

  test("git reset --hard HEAD", async () => {
    const { exitCode } = await runHook("git reset --hard HEAD");
    expect(exitCode).toBe(2);
  });

  test("git reset --hard origin/main", async () => {
    const { exitCode } = await runHook("git reset --hard origin/main");
    expect(exitCode).toBe(2);
  });

  test("git push --force", async () => {
    const { exitCode } = await runHook("git push --force");
    expect(exitCode).toBe(2);
  });

  test("git push -f", async () => {
    const { exitCode } = await runHook("git push -f origin main");
    expect(exitCode).toBe(2);
  });

  test("git clean -f", async () => {
    const { exitCode } = await runHook("git clean -f");
    expect(exitCode).toBe(2);
  });

  test("git clean -fd", async () => {
    const { exitCode } = await runHook("git clean -fd");
    expect(exitCode).toBe(2);
  });

  test("git clean -fdx", async () => {
    const { exitCode } = await runHook("git clean -fdx");
    expect(exitCode).toBe(2);
  });

  test("git clean -xf", async () => {
    const { exitCode } = await runHook("git clean -xf");
    expect(exitCode).toBe(2);
  });

  test("git clean --force", async () => {
    const { exitCode } = await runHook("git clean --force");
    expect(exitCode).toBe(2);
  });

  test("git checkout .", async () => {
    const { exitCode } = await runHook("git checkout .");
    expect(exitCode).toBe(2);
  });

  test("git checkout -- file.ts", async () => {
    const { exitCode } = await runHook("git checkout -- file.ts");
    expect(exitCode).toBe(2);
  });

  test("git branch -D feature", async () => {
    const { exitCode } = await runHook("git branch -D feature");
    expect(exitCode).toBe(2);
  });

  test("git branch --delete --force feature", async () => {
    const { exitCode } = await runHook("git branch --delete --force feature");
    expect(exitCode).toBe(2);
  });

  test("git branch -d --force feature", async () => {
    const { exitCode } = await runHook("git branch -d --force feature");
    expect(exitCode).toBe(2);
  });

  test("git stash drop", async () => {
    const { exitCode } = await runHook("git stash drop");
    expect(exitCode).toBe(2);
  });

  test("git stash clear", async () => {
    const { exitCode } = await runHook("git stash clear");
    expect(exitCode).toBe(2);
  });

  test("git worktree remove --force ../wt", async () => {
    const { exitCode } = await runHook("git worktree remove --force ../wt");
    expect(exitCode).toBe(2);
  });

  test("git worktree remove -f ../wt", async () => {
    const { exitCode } = await runHook("git worktree remove -f ../wt");
    expect(exitCode).toBe(2);
  });
});

describe("Chained / wrapped destructive commands", () => {
  test("ls && git reset --hard", async () => {
    const { exitCode } = await runHook("ls && git reset --hard");
    expect(exitCode).toBe(2);
  });

  test("git status; git reset --hard HEAD", async () => {
    const { exitCode } = await runHook("git status; git reset --hard HEAD");
    expect(exitCode).toBe(2);
  });

  test("false || git push --force", async () => {
    const { exitCode } = await runHook("false || git push --force");
    expect(exitCode).toBe(2);
  });

  test("sudo git reset --hard", async () => {
    const { exitCode } = await runHook("sudo git reset --hard");
    expect(exitCode).toBe(2);
  });

  test("/usr/bin/git push --force", async () => {
    const { exitCode } = await runHook("/usr/bin/git push --force");
    expect(exitCode).toBe(2);
  });

  test("./git reset --hard", async () => {
    const { exitCode } = await runHook("./git reset --hard");
    expect(exitCode).toBe(2);
  });

  test("\\git reset --hard", async () => {
    const { exitCode } = await runHook("\\git reset --hard");
    expect(exitCode).toBe(2);
  });

  test("bash -c 'git reset --hard HEAD'", async () => {
    const { exitCode } = await runHook("bash -c 'git reset --hard HEAD'");
    expect(exitCode).toBe(2);
  });

  test("sh -c 'git push --force'", async () => {
    const { exitCode } = await runHook("sh -c 'git push --force'");
    expect(exitCode).toBe(2);
  });
});

describe("Commands that SHOULD be allowed", () => {
  test("git status", async () => {
    const { exitCode } = await runHook("git status");
    expect(exitCode).toBe(0);
  });

  test("git reset (no flag)", async () => {
    const { exitCode } = await runHook("git reset");
    expect(exitCode).toBe(0);
  });

  test("git reset --soft HEAD~1", async () => {
    const { exitCode } = await runHook("git reset --soft HEAD~1");
    expect(exitCode).toBe(0);
  });

  test("git reset --mixed", async () => {
    const { exitCode } = await runHook("git reset --mixed");
    expect(exitCode).toBe(0);
  });

  test("git reset HEAD~1", async () => {
    const { exitCode } = await runHook("git reset HEAD~1");
    expect(exitCode).toBe(0);
  });

  test("git push", async () => {
    const { exitCode } = await runHook("git push");
    expect(exitCode).toBe(0);
  });

  test("git push origin main", async () => {
    const { exitCode } = await runHook("git push origin main");
    expect(exitCode).toBe(0);
  });

  test("git push --force-with-lease", async () => {
    const { exitCode } = await runHook("git push --force-with-lease");
    expect(exitCode).toBe(0);
  });

  test("git push --force-with-lease=ref:expected", async () => {
    const { exitCode } = await runHook(
      "git push --force-with-lease=main:abc123"
    );
    expect(exitCode).toBe(0);
  });

  test("git checkout main", async () => {
    const { exitCode } = await runHook("git checkout main");
    expect(exitCode).toBe(0);
  });

  test("git checkout -b feature", async () => {
    const { exitCode } = await runHook("git checkout -b feature");
    expect(exitCode).toBe(0);
  });

  test("git clean -n", async () => {
    const { exitCode } = await runHook("git clean -n");
    expect(exitCode).toBe(0);
  });

  test("git clean --dry-run", async () => {
    const { exitCode } = await runHook("git clean --dry-run");
    expect(exitCode).toBe(0);
  });

  test("git stash", async () => {
    const { exitCode } = await runHook("git stash");
    expect(exitCode).toBe(0);
  });

  test("git stash push -m msg", async () => {
    const { exitCode } = await runHook("git stash push -m 'wip'");
    expect(exitCode).toBe(0);
  });

  test("git stash pop", async () => {
    const { exitCode } = await runHook("git stash pop");
    expect(exitCode).toBe(0);
  });

  test("git stash apply", async () => {
    const { exitCode } = await runHook("git stash apply");
    expect(exitCode).toBe(0);
  });

  test("git stash list", async () => {
    const { exitCode } = await runHook("git stash list");
    expect(exitCode).toBe(0);
  });

  test("git branch -d merged", async () => {
    const { exitCode } = await runHook("git branch -d merged");
    expect(exitCode).toBe(0);
  });

  test("git branch", async () => {
    const { exitCode } = await runHook("git branch");
    expect(exitCode).toBe(0);
  });

  test("git worktree remove ../wt", async () => {
    const { exitCode } = await runHook("git worktree remove ../wt");
    expect(exitCode).toBe(0);
  });

  test("git commit -m 'revert reset --hard' (quoted)", async () => {
    const { exitCode } = await runHook(
      "git commit -m 'revert reset --hard'"
    );
    expect(exitCode).toBe(0);
  });

  test("echo 'git reset --hard' (quoted)", async () => {
    const { exitCode } = await runHook("echo 'git reset --hard'");
    expect(exitCode).toBe(0);
  });

  test('echo "git push --force" (double quoted)', async () => {
    const { exitCode } = await runHook('echo "git push --force"');
    expect(exitCode).toBe(0);
  });

  test("grep 'git reset --hard' file.txt", async () => {
    const { exitCode } = await runHook("grep 'git reset --hard' file.txt");
    expect(exitCode).toBe(0);
  });

  test("ls -la", async () => {
    const { exitCode } = await runHook("ls -la");
    expect(exitCode).toBe(0);
  });
});

describe("Quoted flag bypass (P1)", () => {
  test("git reset '--hard' (single-quoted flag)", async () => {
    const { exitCode } = await runHook("git reset '--hard'");
    expect(exitCode).toBe(2);
  });

  test('git push "--force" (double-quoted flag)', async () => {
    const { exitCode } = await runHook('git push "--force"');
    expect(exitCode).toBe(2);
  });

  test("git reset '--hard' HEAD (quoted flag with arg)", async () => {
    const { exitCode } = await runHook("git reset '--hard' HEAD");
    expect(exitCode).toBe(2);
  });

  test("git clean '-fdx' (quoted flag cluster)", async () => {
    const { exitCode } = await runHook("git clean '-fdx'");
    expect(exitCode).toBe(2);
  });

  test("git branch '-D' feature (quoted force-delete)", async () => {
    const { exitCode } = await runHook("git branch '-D' feature");
    expect(exitCode).toBe(2);
  });

  // Make sure quoted non-flag strings are still allowed.
  test("echo 'git reset --hard' still allowed (quoted full command)", async () => {
    const { exitCode } = await runHook("echo 'git reset --hard'");
    expect(exitCode).toBe(0);
  });

  test("git commit -m 'fix --hard reset bug' still allowed", async () => {
    const { exitCode } = await runHook(
      "git commit -m 'fix --hard reset bug'"
    );
    expect(exitCode).toBe(0);
  });
});

describe("Newline command separator (P2)", () => {
  test("echo ok\\ngit reset --hard", async () => {
    const { exitCode } = await runHook("echo ok\ngit reset --hard");
    expect(exitCode).toBe(2);
  });

  test("multi-line: ls\\ngit push --force\\necho done", async () => {
    const { exitCode } = await runHook("ls\ngit push --force\necho done");
    expect(exitCode).toBe(2);
  });

  test("CRLF separator: echo ok\\r\\ngit reset --hard", async () => {
    const { exitCode } = await runHook("echo ok\r\ngit reset --hard");
    expect(exitCode).toBe(2);
  });

  test("heredoc-ish multi-line still allows safe second line", async () => {
    const { exitCode } = await runHook("echo ok\ngit status");
    expect(exitCode).toBe(0);
  });
});

describe("Git global options before subcommand (P3)", () => {
  test("git -C ../repo reset --hard", async () => {
    const { exitCode } = await runHook("git -C ../repo reset --hard");
    expect(exitCode).toBe(2);
  });

  test("git -c core.sshCommand=foo push --force", async () => {
    const { exitCode } = await runHook(
      "git -c core.sshCommand=foo push --force"
    );
    expect(exitCode).toBe(2);
  });

  test("git --git-dir=/tmp/.git reset --hard", async () => {
    const { exitCode } = await runHook("git --git-dir=/tmp/.git reset --hard");
    expect(exitCode).toBe(2);
  });

  test("git --no-pager push --force", async () => {
    const { exitCode } = await runHook("git --no-pager push --force");
    expect(exitCode).toBe(2);
  });

  test("git -P clean -fdx", async () => {
    const { exitCode } = await runHook("git -P clean -fdx");
    expect(exitCode).toBe(2);
  });

  test("git -C dir -c key=val branch -D feature", async () => {
    const { exitCode } = await runHook(
      "git -C dir -c key=val branch -D feature"
    );
    expect(exitCode).toBe(2);
  });

  // Global options should still let safe subcommands through.
  test("git -C ../repo status (still allowed)", async () => {
    const { exitCode } = await runHook("git -C ../repo status");
    expect(exitCode).toBe(0);
  });

  test("git -C ../repo push --force-with-lease (still allowed)", async () => {
    const { exitCode } = await runHook(
      "git -C ../repo push --force-with-lease"
    );
    expect(exitCode).toBe(0);
  });
});

describe("Long global options with separate value (P1 follow-up)", () => {
  test("git --git-dir /tmp/.git reset --hard", async () => {
    const { exitCode } = await runHook(
      "git --git-dir /tmp/.git reset --hard"
    );
    expect(exitCode).toBe(2);
  });

  test("git --work-tree /tmp push --force", async () => {
    const { exitCode } = await runHook("git --work-tree /tmp push --force");
    expect(exitCode).toBe(2);
  });

  test("git --namespace foo clean -fdx", async () => {
    const { exitCode } = await runHook("git --namespace foo clean -fdx");
    expect(exitCode).toBe(2);
  });

  test("git --exec-path /tmp branch -D feature", async () => {
    const { exitCode } = await runHook(
      "git --exec-path /tmp branch -D feature"
    );
    expect(exitCode).toBe(2);
  });

  test("git --git-dir=/tmp/.git reset --hard (= form still works)", async () => {
    const { exitCode } = await runHook(
      "git --git-dir=/tmp/.git reset --hard"
    );
    expect(exitCode).toBe(2);
  });

  test("git --git-dir /tmp/.git status (still allowed)", async () => {
    const { exitCode } = await runHook("git --git-dir /tmp/.git status");
    expect(exitCode).toBe(0);
  });
});

describe("Quoted prefix false positives (P2 follow-up)", () => {
  test('echo "" git reset --hard (echoes only, not blocked)', async () => {
    const { exitCode } = await runHook('echo "" git reset --hard');
    expect(exitCode).toBe(0);
  });

  test('echo "prefix" git push --force (echoes only, not blocked)', async () => {
    const { exitCode } = await runHook('echo "prefix" git push --force');
    expect(exitCode).toBe(0);
  });

  test('printf "%s" git clean -fdx (printfs only, not blocked)', async () => {
    const { exitCode } = await runHook('printf "%s" git clean -fdx');
    expect(exitCode).toBe(0);
  });

  test("echo 'foo' git reset --hard (single-quoted prefix)", async () => {
    const { exitCode } = await runHook("echo 'foo' git reset --hard");
    expect(exitCode).toBe(0);
  });

  // Subshells must still be blocked even though they use quotes.
  test("bash -c 'git reset --hard HEAD' still blocked", async () => {
    const { exitCode } = await runHook("bash -c 'git reset --hard HEAD'");
    expect(exitCode).toBe(2);
  });

  test('sh -c "git push --force" still blocked', async () => {
    const { exitCode } = await runHook('sh -c "git push --force"');
    expect(exitCode).toBe(2);
  });
});

describe("Wrapper options before git (P1 follow-up)", () => {
  test("sudo -n git reset --hard", async () => {
    const { exitCode } = await runHook("sudo -n git reset --hard");
    expect(exitCode).toBe(2);
  });

  test("sudo -E git push --force", async () => {
    const { exitCode } = await runHook("sudo -E git push --force");
    expect(exitCode).toBe(2);
  });

  test("sudo -u root git clean -fdx", async () => {
    const { exitCode } = await runHook("sudo -u root git clean -fdx");
    expect(exitCode).toBe(2);
  });

  test("env FOO=bar git reset --hard", async () => {
    const { exitCode } = await runHook("env FOO=bar git reset --hard");
    expect(exitCode).toBe(2);
  });

  test("env FOO=bar BAZ=qux git push --force", async () => {
    const { exitCode } = await runHook(
      "env FOO=bar BAZ=qux git push --force"
    );
    expect(exitCode).toBe(2);
  });

  test("env -i git reset --hard", async () => {
    const { exitCode } = await runHook("env -i git reset --hard");
    expect(exitCode).toBe(2);
  });

  test("env -u VAR git branch -D feature", async () => {
    const { exitCode } = await runHook("env -u VAR git branch -D feature");
    expect(exitCode).toBe(2);
  });

  // Wrappers should still let safe commands through.
  test("sudo -n git status (still allowed)", async () => {
    const { exitCode } = await runHook("sudo -n git status");
    expect(exitCode).toBe(0);
  });

  test("env FOO=bar git status (still allowed)", async () => {
    const { exitCode } = await runHook("env FOO=bar git status");
    expect(exitCode).toBe(0);
  });
});

describe("Subshell variants (P2 follow-up)", () => {
  test("bash -lc 'git reset --hard'", async () => {
    const { exitCode } = await runHook("bash -lc 'git reset --hard'");
    expect(exitCode).toBe(2);
  });

  test("bash -l -c 'git reset --hard'", async () => {
    const { exitCode } = await runHook("bash -l -c 'git reset --hard'");
    expect(exitCode).toBe(2);
  });

  test("bash -ic 'git push --force'", async () => {
    const { exitCode } = await runHook("bash -ic 'git push --force'");
    expect(exitCode).toBe(2);
  });

  test("zsh -ic 'git reset --hard'", async () => {
    const { exitCode } = await runHook("zsh -ic 'git reset --hard'");
    expect(exitCode).toBe(2);
  });

  test("bash --login -c 'git reset --hard'", async () => {
    const { exitCode } = await runHook(
      "bash --login -c 'git reset --hard'"
    );
    expect(exitCode).toBe(2);
  });

  test("bash -lc 'git status' (still allowed)", async () => {
    const { exitCode } = await runHook("bash -lc 'git status'");
    expect(exitCode).toBe(0);
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
