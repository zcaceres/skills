import { describe, test, expect } from "bun:test";
import { spawn } from "bun";
import { join } from "path";

const HOOK_PATH = join(import.meta.dir, "..", "scripts", "index.ts");

async function runHook(
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<{ exitCode: number; stderr: string }> {
  const input = JSON.stringify({ tool_name: toolName, tool_input: toolInput });

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

const expectBlocked = async (cmd: string) => {
  const { exitCode, stderr } = await runHook("Bash", { command: cmd });
  expect(exitCode).toBe(2);
  expect(stderr).toContain("BLOCKED");
};

const expectAllowed = async (cmd: string) => {
  const { exitCode } = await runHook("Bash", { command: cmd });
  expect(exitCode).toBe(0);
};

describe("Blocked: bare `op read`", () => {
  test("top-level op read", async () => {
    await expectBlocked('op read "op://Vault/Item/field"');
  });

  test("op read with redirect to file", async () => {
    await expectBlocked('op read "op://Vault/Item/field" > /tmp/leak');
  });

  test("op read appended to file", async () => {
    await expectBlocked('op read "op://Vault/Item/field" >> /tmp/leak');
  });

  test("op read piped to tee", async () => {
    await expectBlocked('op read "op://Vault/Item/field" | tee /tmp/x');
  });

  test("op read in command substitution $()", async () => {
    await expectBlocked('VAR=$(op read "op://Vault/Item/field")');
  });

  test("op read in backticks", async () => {
    await expectBlocked('VAR=`op read "op://Vault/Item/field"`');
  });

  test("op read after &&", async () => {
    await expectBlocked('op signin && op read "op://Vault/Item/field"');
  });

  test("op read in semicolon list", async () => {
    await expectBlocked('cd /tmp; op read "op://Vault/Item/field"');
  });

  test("op read with no quotes around the ref", async () => {
    await expectBlocked("op read op://Vault/Item/field");
  });
});

describe("Blocked: secret-printing `op` subcommands", () => {
  test("op item get --reveal", async () => {
    await expectBlocked("op item get myitem --reveal");
  });

  test("op item get --format=json", async () => {
    await expectBlocked("op item get myitem --format=json");
  });

  test("op item get --format json (space form)", async () => {
    await expectBlocked("op item get myitem --format json");
  });

  test("op inject from stdin", async () => {
    await expectBlocked("op inject -i template.tpl");
  });

  test("op inject piped to a file", async () => {
    await expectBlocked("op inject -i template.tpl > resolved.conf");
  });
});

describe("Blocked: subshell / eval bypass", () => {
  test("bash -c with op read", async () => {
    await expectBlocked(`bash -c 'op read "op://Vault/Item/field"'`);
  });

  test("sh -c with op read", async () => {
    await expectBlocked(`sh -c 'op read "op://Vault/Item/field"'`);
  });

  test("zsh -c with op item get --reveal", async () => {
    await expectBlocked(`zsh -c 'op item get myitem --reveal'`);
  });

  test("eval with op read", async () => {
    await expectBlocked(`eval 'op read "op://Vault/Item/field"'`);
  });

  test("eval with op inject", async () => {
    await expectBlocked(`eval 'op inject -i template.tpl'`);
  });
});

describe("Blocked: regression — bypasses closed in fix-op-creds-hook-bypasses", () => {
  // Issue #1: procsub mask used to swallow shell redirects / op output flags.
  test("redirect inside <(op read ...) writes secret to disk", async () => {
    await expectBlocked(`cat <(op read "op://Vault/Item/field" > /tmp/leak)`);
  });

  test("append redirect inside <(op read ...) writes secret to disk", async () => {
    await expectBlocked(`cat <(op read "op://Vault/Item/field" >> /tmp/leak)`);
  });

  test("pipe-to-tee inside <(op read ...) duplicates secret to disk", async () => {
    await expectBlocked(`cat <(op read "op://Vault/Item/field" | tee /tmp/x)`);
  });

  test("op inject -o /tmp/x inside <(...) writes resolved template to disk", async () => {
    await expectBlocked(`cat <(op inject -i tpl -o /tmp/resolved)`);
  });

  test("op inject --out-file inside <(...) writes resolved template to disk", async () => {
    await expectBlocked(
      `cat <(op inject -i tpl --out-file /tmp/resolved)`
    );
  });

  test("op read --out-file inside <(...) writes secret to disk", async () => {
    await expectBlocked(
      `cat <(op read --out-file /tmp/x "op://Vault/Item/field")`
    );
  });

  test("command chaining inside <(...) hides a bare op read", async () => {
    await expectBlocked(`cat <(true; op read "op://Vault/Item/field")`);
  });

  // Issue #2: bundled shell flags like -lc bypassed the raw scan.
  test("bash -lc with op read (login shell flag bundle)", async () => {
    await expectBlocked(`bash -lc 'op read "op://Vault/Item/field"'`);
  });

  test("bash -ilc with op read (interactive login flag bundle)", async () => {
    await expectBlocked(`bash -ilc 'op read "op://Vault/Item/field"'`);
  });

  test("zsh -lc with op item get --reveal", async () => {
    await expectBlocked(`zsh -lc 'op item get myitem --reveal'`);
  });

  test("sh -lc with op inject", async () => {
    await expectBlocked(`sh -lc 'op inject -i template.tpl'`);
  });

  // Issue #3: quoted dangerous args were erased before scanning.
  test('op item get with quoted "--reveal" argv', async () => {
    await expectBlocked(`op item get myitem "--reveal"`);
  });

  test("op item get with single-quoted '--reveal' argv", async () => {
    await expectBlocked(`op item get myitem '--reveal'`);
  });

  test('op item get --format with quoted "json" argv', async () => {
    await expectBlocked(`op item get myitem --format "json"`);
  });

  test("op item get --format with single-quoted 'json' argv", async () => {
    await expectBlocked(`op item get myitem --format 'json'`);
  });

  test('op item get with quoted "--format=json" argv', async () => {
    await expectBlocked(`op item get myitem "--format=json"`);
  });
});

describe("Allowed: safe process-substitution patterns", () => {
  test("ssh -i <(op read ...)", async () => {
    await expectAllowed(
      `ssh -i <(op read "op://Vault/SSH/private") user@host`
    );
  });

  test("curl --cert-file <(op read ...)", async () => {
    await expectAllowed(
      `curl --cert-file <(op read "op://Vault/MyApp/cert") https://api.example.com`
    );
  });

  test("aws --config-file <(op inject -i tpl)", async () => {
    await expectAllowed(
      `aws --config-file <(op inject -i aws-config.tpl) s3 ls`
    );
  });

  test("process substitution with whitespace inside parens", async () => {
    await expectAllowed(
      `cmd --in <( op read "op://Vault/Item/field" )`
    );
  });

  test("multiple <( op read ... ) in one command", async () => {
    await expectAllowed(
      `cmd --a <(op read "op://X/A/v") --b <(op read "op://X/B/v")`
    );
  });
});

describe("Allowed: `op run` and read-only op subcommands", () => {
  test("op run with env-file", async () => {
    await expectAllowed("op run --env-file=.env.template -- aws s3 ls");
  });

  test("op run with process-substitution env-file", async () => {
    await expectAllowed(
      `op run --env-file=<(printf 'API_KEY=op://X/Y/z') -- curl https://api`
    );
  });

  test("op signin", async () => {
    await expectAllowed("op signin");
  });

  test("op whoami", async () => {
    await expectAllowed("op whoami");
  });

  test("op vault list", async () => {
    await expectAllowed("op vault list");
  });

  test("op item list", async () => {
    await expectAllowed("op item list --vault Personal");
  });

  test("op item get without --reveal or --format json", async () => {
    await expectAllowed("op item get myitem");
  });

  test("op account list", async () => {
    await expectAllowed("op account list");
  });
});

describe("Allowed: bundled `with-creds` wrapper", () => {
  test("with-creds --env -- prog", async () => {
    await expectAllowed(
      "with-creds --env API_KEY=op://Vault/Item/field -- curl https://api"
    );
  });

  test("with-creds --fd -- prog", async () => {
    await expectAllowed(
      "with-creds --fd KEY=op://Vault/Item/field -- ssh -i %KEY% host"
    );
  });

  // Documented examples from SKILL.md "Mixing both modes" — must remain
  // allowed so users following the docs aren't blocked.
  test("with-creds --env --env --fd -- aws (env-native consumer)", async () => {
    await expectAllowed(
      "with-creds --env AWS_ACCESS_KEY_ID=op://Vault/AWS/access_key_id " +
        "--env AWS_SECRET_ACCESS_KEY=op://Vault/AWS/secret_access_key " +
        "--fd CA=op://Vault/AWS/ca_bundle -- aws --ca-bundle %CA% s3 ls"
    );
  });

  test("with-creds wrapping `sh -c` so the inner shell interpolates $API_KEY", async () => {
    await expectAllowed(
      "with-creds --env API_KEY=op://Work/Service/api_key " +
        "--fd CA=op://Work/Service/ca_bundle " +
        `-- sh -c 'curl --cacert "$1" -H "Authorization: Bearer $API_KEY" https://api.example.com' _ %CA%`
    );
  });
});

describe("Allowed: legitimate quoted mentions", () => {
  test("echo mentioning op read", async () => {
    await expectAllowed(`echo "remember to use op read inside <(...)"`);
  });

  test("git commit message mentioning op read", async () => {
    await expectAllowed(`git commit -m "Document op read usage"`);
  });

  test("grep -E with op read pattern", async () => {
    await expectAllowed(`grep -E "op read|op inject" docs/`);
  });
});

describe("Allowed: other tools (hook only matches Bash)", () => {
  test("Read tool passes through", async () => {
    const { exitCode } = await runHook("Read", { file_path: "/repo/README.md" });
    expect(exitCode).toBe(0);
  });

  test("Edit tool passes through", async () => {
    const { exitCode } = await runHook("Edit", {
      file_path: "/repo/x",
      old_string: "op read",
      new_string: "op run",
    });
    expect(exitCode).toBe(0);
  });

  test("empty input passes through", async () => {
    const proc = spawn({
      cmd: ["bun", "run", HOOK_PATH],
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });
    proc.stdin.end();
    const exitCode = await proc.exited;
    expect(exitCode).toBe(0);
  });
});

describe("Fail-open posture (hook errors)", () => {
  test("malformed JSON fails open with an observable stderr message", async () => {
    const proc = spawn({
      cmd: ["bun", "run", HOOK_PATH],
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });
    proc.stdin.write("{this is not json");
    proc.stdin.end();
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();
    // Fail-open so the user's tool call isn't broken...
    expect(exitCode).toBe(0);
    // ...but the failure must be visible so silent disablement is observable.
    expect(stderr).toContain("safety-op-creds: hook error");
    expect(stderr).toContain("NOT screening");
  });
});
