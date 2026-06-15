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
  test("git reset --hard", async () => {
    const { exitCode, decision, reason } = await runHook("git reset --hard");
    expect(exitCode).toBe(0);
    expect(decision).toBe("deny");
    expect(reason).toContain("BLOCKED");
  });

  test("git reset --hard HEAD", async () => {
    const { decision } = await runHook("git reset --hard HEAD");
    expect(decision).toBe("deny");
  });

  test("git reset --hard origin/main", async () => {
    const { decision } = await runHook("git reset --hard origin/main");
    expect(decision).toBe("deny");
  });

  test("git push --force", async () => {
    const { decision } = await runHook("git push --force");
    expect(decision).toBe("deny");
  });

  test("git push -f", async () => {
    const { decision } = await runHook("git push -f origin main");
    expect(decision).toBe("deny");
  });

  test("git clean -f", async () => {
    const { decision } = await runHook("git clean -f");
    expect(decision).toBe("deny");
  });

  test("git clean -fd", async () => {
    const { decision } = await runHook("git clean -fd");
    expect(decision).toBe("deny");
  });

  test("git clean -fdx", async () => {
    const { decision } = await runHook("git clean -fdx");
    expect(decision).toBe("deny");
  });

  test("git clean -xf", async () => {
    const { decision } = await runHook("git clean -xf");
    expect(decision).toBe("deny");
  });

  test("git clean --force", async () => {
    const { decision } = await runHook("git clean --force");
    expect(decision).toBe("deny");
  });

  test("git checkout .", async () => {
    const { decision } = await runHook("git checkout .");
    expect(decision).toBe("deny");
  });

  test("git checkout -- file.ts", async () => {
    const { decision } = await runHook("git checkout -- file.ts");
    expect(decision).toBe("deny");
  });

  test("git branch -D feature", async () => {
    const { decision } = await runHook("git branch -D feature");
    expect(decision).toBe("deny");
  });

  test("git branch --delete --force feature", async () => {
    const { decision } = await runHook("git branch --delete --force feature");
    expect(decision).toBe("deny");
  });

  test("git branch -d --force feature", async () => {
    const { decision } = await runHook("git branch -d --force feature");
    expect(decision).toBe("deny");
  });

  test("git stash drop", async () => {
    const { decision } = await runHook("git stash drop");
    expect(decision).toBe("deny");
  });

  test("git stash clear", async () => {
    const { decision } = await runHook("git stash clear");
    expect(decision).toBe("deny");
  });

  test("git worktree remove --force ../wt", async () => {
    const { decision } = await runHook("git worktree remove --force ../wt");
    expect(decision).toBe("deny");
  });

  test("git worktree remove -f ../wt", async () => {
    const { decision } = await runHook("git worktree remove -f ../wt");
    expect(decision).toBe("deny");
  });
});

describe("Chained / wrapped destructive commands", () => {
  test("ls && git reset --hard", async () => {
    const { decision } = await runHook("ls && git reset --hard");
    expect(decision).toBe("deny");
  });

  test("git status; git reset --hard HEAD", async () => {
    const { decision } = await runHook("git status; git reset --hard HEAD");
    expect(decision).toBe("deny");
  });

  test("false || git push --force", async () => {
    const { decision } = await runHook("false || git push --force");
    expect(decision).toBe("deny");
  });

  test("sudo git reset --hard", async () => {
    const { decision } = await runHook("sudo git reset --hard");
    expect(decision).toBe("deny");
  });

  test("/usr/bin/git push --force", async () => {
    const { decision } = await runHook("/usr/bin/git push --force");
    expect(decision).toBe("deny");
  });

  test("./git reset --hard", async () => {
    const { decision } = await runHook("./git reset --hard");
    expect(decision).toBe("deny");
  });

  test("\\git reset --hard", async () => {
    const { decision } = await runHook("\\git reset --hard");
    expect(decision).toBe("deny");
  });

  test("bash -c 'git reset --hard HEAD'", async () => {
    const { decision } = await runHook("bash -c 'git reset --hard HEAD'");
    expect(decision).toBe("deny");
  });

  test("sh -c 'git push --force'", async () => {
    const { decision } = await runHook("sh -c 'git push --force'");
    expect(decision).toBe("deny");
  });
});

describe("Commands that SHOULD be allowed", () => {
  test("git status", async () => {
    const { exitCode, decision } = await runHook("git status");
    expect(exitCode).toBe(0);
    expect(decision).toBeNull();
  });

  test("git reset (no flag)", async () => {
    const { decision } = await runHook("git reset");
    expect(decision).toBeNull();
  });

  test("git reset --soft HEAD~1", async () => {
    const { decision } = await runHook("git reset --soft HEAD~1");
    expect(decision).toBeNull();
  });

  test("git reset --mixed", async () => {
    const { decision } = await runHook("git reset --mixed");
    expect(decision).toBeNull();
  });

  test("git reset HEAD~1", async () => {
    const { decision } = await runHook("git reset HEAD~1");
    expect(decision).toBeNull();
  });

  test("git push", async () => {
    const { decision } = await runHook("git push");
    expect(decision).toBeNull();
  });

  test("git push origin main", async () => {
    const { decision } = await runHook("git push origin main");
    expect(decision).toBeNull();
  });

  test("git push --force-with-lease", async () => {
    const { decision } = await runHook("git push --force-with-lease");
    expect(decision).toBeNull();
  });

  test("git push --force-with-lease=ref:expected", async () => {
    const { decision } = await runHook("git push --force-with-lease=main:abc123");
    expect(decision).toBeNull();
  });

  test("git checkout main", async () => {
    const { decision } = await runHook("git checkout main");
    expect(decision).toBeNull();
  });

  test("git checkout -b feature", async () => {
    const { decision } = await runHook("git checkout -b feature");
    expect(decision).toBeNull();
  });

  test("git clean -n", async () => {
    const { decision } = await runHook("git clean -n");
    expect(decision).toBeNull();
  });

  test("git clean --dry-run", async () => {
    const { decision } = await runHook("git clean --dry-run");
    expect(decision).toBeNull();
  });

  test("git stash", async () => {
    const { decision } = await runHook("git stash");
    expect(decision).toBeNull();
  });

  test("git stash push -m msg", async () => {
    const { decision } = await runHook("git stash push -m 'wip'");
    expect(decision).toBeNull();
  });

  test("git stash pop", async () => {
    const { decision } = await runHook("git stash pop");
    expect(decision).toBeNull();
  });

  test("git stash apply", async () => {
    const { decision } = await runHook("git stash apply");
    expect(decision).toBeNull();
  });

  test("git stash list", async () => {
    const { decision } = await runHook("git stash list");
    expect(decision).toBeNull();
  });

  test("git branch -d merged", async () => {
    const { decision } = await runHook("git branch -d merged");
    expect(decision).toBeNull();
  });

  test("git branch", async () => {
    const { decision } = await runHook("git branch");
    expect(decision).toBeNull();
  });

  test("git worktree remove ../wt", async () => {
    const { decision } = await runHook("git worktree remove ../wt");
    expect(decision).toBeNull();
  });

  test("git commit -m 'revert reset --hard' (quoted)", async () => {
    const { decision } = await runHook("git commit -m 'revert reset --hard'");
    expect(decision).toBeNull();
  });

  test("echo 'git reset --hard' (quoted)", async () => {
    const { decision } = await runHook("echo 'git reset --hard'");
    expect(decision).toBeNull();
  });

  test('echo "git push --force" (double quoted)', async () => {
    const { decision } = await runHook('echo "git push --force"');
    expect(decision).toBeNull();
  });

  test("grep 'git reset --hard' file.txt", async () => {
    const { decision } = await runHook("grep 'git reset --hard' file.txt");
    expect(decision).toBeNull();
  });

  test("ls -la", async () => {
    const { decision } = await runHook("ls -la");
    expect(decision).toBeNull();
  });
});

describe("Quoted flag bypass (P1)", () => {
  test("git reset '--hard' (single-quoted flag)", async () => {
    const { decision } = await runHook("git reset '--hard'");
    expect(decision).toBe("deny");
  });

  test('git push "--force" (double-quoted flag)', async () => {
    const { decision } = await runHook('git push "--force"');
    expect(decision).toBe("deny");
  });

  test("git reset '--hard' HEAD (quoted flag with arg)", async () => {
    const { decision } = await runHook("git reset '--hard' HEAD");
    expect(decision).toBe("deny");
  });

  test("git clean '-fdx' (quoted flag cluster)", async () => {
    const { decision } = await runHook("git clean '-fdx'");
    expect(decision).toBe("deny");
  });

  test("git branch '-D' feature (quoted force-delete)", async () => {
    const { decision } = await runHook("git branch '-D' feature");
    expect(decision).toBe("deny");
  });

  // Make sure quoted non-flag strings are still allowed.
  test("echo 'git reset --hard' still allowed (quoted full command)", async () => {
    const { decision } = await runHook("echo 'git reset --hard'");
    expect(decision).toBeNull();
  });

  test("git commit -m 'fix --hard reset bug' still allowed", async () => {
    const { decision } = await runHook("git commit -m 'fix --hard reset bug'");
    expect(decision).toBeNull();
  });
});

describe("Newline command separator (P2)", () => {
  test("echo ok\\ngit reset --hard", async () => {
    const { decision } = await runHook("echo ok\ngit reset --hard");
    expect(decision).toBe("deny");
  });

  test("multi-line: ls\\ngit push --force\\necho done", async () => {
    const { decision } = await runHook("ls\ngit push --force\necho done");
    expect(decision).toBe("deny");
  });

  test("CRLF separator: echo ok\\r\\ngit reset --hard", async () => {
    const { decision } = await runHook("echo ok\r\ngit reset --hard");
    expect(decision).toBe("deny");
  });

  test("heredoc-ish multi-line still allows safe second line", async () => {
    const { decision } = await runHook("echo ok\ngit status");
    expect(decision).toBeNull();
  });
});

describe("Git global options before subcommand (P3)", () => {
  test("git -C ../repo reset --hard", async () => {
    const { decision } = await runHook("git -C ../repo reset --hard");
    expect(decision).toBe("deny");
  });

  test("git -c core.sshCommand=foo push --force", async () => {
    const { decision } = await runHook("git -c core.sshCommand=foo push --force");
    expect(decision).toBe("deny");
  });

  test("git --git-dir=/tmp/.git reset --hard", async () => {
    const { decision } = await runHook("git --git-dir=/tmp/.git reset --hard");
    expect(decision).toBe("deny");
  });

  test("git --no-pager push --force", async () => {
    const { decision } = await runHook("git --no-pager push --force");
    expect(decision).toBe("deny");
  });

  test("git -P clean -fdx", async () => {
    const { decision } = await runHook("git -P clean -fdx");
    expect(decision).toBe("deny");
  });

  test("git -C dir -c key=val branch -D feature", async () => {
    const { decision } = await runHook("git -C dir -c key=val branch -D feature");
    expect(decision).toBe("deny");
  });

  // Global options should still let safe subcommands through.
  test("git -C ../repo status (still allowed)", async () => {
    const { decision } = await runHook("git -C ../repo status");
    expect(decision).toBeNull();
  });

  test("git -C ../repo push --force-with-lease (still allowed)", async () => {
    const { decision } = await runHook("git -C ../repo push --force-with-lease");
    expect(decision).toBeNull();
  });
});

describe("Long global options with separate value (P1 follow-up)", () => {
  test("git --git-dir /tmp/.git reset --hard", async () => {
    const { decision } = await runHook("git --git-dir /tmp/.git reset --hard");
    expect(decision).toBe("deny");
  });

  test("git --work-tree /tmp push --force", async () => {
    const { decision } = await runHook("git --work-tree /tmp push --force");
    expect(decision).toBe("deny");
  });

  test("git --namespace foo clean -fdx", async () => {
    const { decision } = await runHook("git --namespace foo clean -fdx");
    expect(decision).toBe("deny");
  });

  test("git --exec-path /tmp branch -D feature", async () => {
    const { decision } = await runHook("git --exec-path /tmp branch -D feature");
    expect(decision).toBe("deny");
  });

  test("git --git-dir=/tmp/.git reset --hard (= form still works)", async () => {
    const { decision } = await runHook("git --git-dir=/tmp/.git reset --hard");
    expect(decision).toBe("deny");
  });

  test("git --git-dir /tmp/.git status (still allowed)", async () => {
    const { decision } = await runHook("git --git-dir /tmp/.git status");
    expect(decision).toBeNull();
  });
});

describe("Quoted prefix false positives (P2 follow-up)", () => {
  test('echo "" git reset --hard (echoes only, not blocked)', async () => {
    const { decision } = await runHook('echo "" git reset --hard');
    expect(decision).toBeNull();
  });

  test('echo "prefix" git push --force (echoes only, not blocked)', async () => {
    const { decision } = await runHook('echo "prefix" git push --force');
    expect(decision).toBeNull();
  });

  test('printf "%s" git clean -fdx (printfs only, not blocked)', async () => {
    const { decision } = await runHook('printf "%s" git clean -fdx');
    expect(decision).toBeNull();
  });

  test("echo 'foo' git reset --hard (single-quoted prefix)", async () => {
    const { decision } = await runHook("echo 'foo' git reset --hard");
    expect(decision).toBeNull();
  });

  // Subshells must still be blocked even though they use quotes.
  test("bash -c 'git reset --hard HEAD' still blocked", async () => {
    const { decision } = await runHook("bash -c 'git reset --hard HEAD'");
    expect(decision).toBe("deny");
  });

  test('sh -c "git push --force" still blocked', async () => {
    const { decision } = await runHook('sh -c "git push --force"');
    expect(decision).toBe("deny");
  });
});

describe("Wrapper options before git (P1 follow-up)", () => {
  test("sudo -n git reset --hard", async () => {
    const { decision } = await runHook("sudo -n git reset --hard");
    expect(decision).toBe("deny");
  });

  test("sudo -E git push --force", async () => {
    const { decision } = await runHook("sudo -E git push --force");
    expect(decision).toBe("deny");
  });

  test("sudo -u root git clean -fdx", async () => {
    const { decision } = await runHook("sudo -u root git clean -fdx");
    expect(decision).toBe("deny");
  });

  test("env FOO=bar git reset --hard", async () => {
    const { decision } = await runHook("env FOO=bar git reset --hard");
    expect(decision).toBe("deny");
  });

  test("env FOO=bar BAZ=qux git push --force", async () => {
    const { decision } = await runHook("env FOO=bar BAZ=qux git push --force");
    expect(decision).toBe("deny");
  });

  test("env -i git reset --hard", async () => {
    const { decision } = await runHook("env -i git reset --hard");
    expect(decision).toBe("deny");
  });

  test("env -u VAR git branch -D feature", async () => {
    const { decision } = await runHook("env -u VAR git branch -D feature");
    expect(decision).toBe("deny");
  });

  // Wrappers should still let safe commands through.
  test("sudo -n git status (still allowed)", async () => {
    const { decision } = await runHook("sudo -n git status");
    expect(decision).toBeNull();
  });

  test("env FOO=bar git status (still allowed)", async () => {
    const { decision } = await runHook("env FOO=bar git status");
    expect(decision).toBeNull();
  });
});

describe("Subshell variants (P2 follow-up)", () => {
  test("bash -lc 'git reset --hard'", async () => {
    const { decision } = await runHook("bash -lc 'git reset --hard'");
    expect(decision).toBe("deny");
  });

  test("bash -l -c 'git reset --hard'", async () => {
    const { decision } = await runHook("bash -l -c 'git reset --hard'");
    expect(decision).toBe("deny");
  });

  test("bash -ic 'git push --force'", async () => {
    const { decision } = await runHook("bash -ic 'git push --force'");
    expect(decision).toBe("deny");
  });

  test("zsh -ic 'git reset --hard'", async () => {
    const { decision } = await runHook("zsh -ic 'git reset --hard'");
    expect(decision).toBe("deny");
  });

  test("bash --login -c 'git reset --hard'", async () => {
    const { decision } = await runHook("bash --login -c 'git reset --hard'");
    expect(decision).toBe("deny");
  });

  test("bash -lc 'git status' (still allowed)", async () => {
    const { decision } = await runHook("bash -lc 'git status'");
    expect(decision).toBeNull();
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
