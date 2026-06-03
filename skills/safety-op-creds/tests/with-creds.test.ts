import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { spawn } from "bun";
import { join } from "path";
import { mkdtempSync, rmSync, writeFileSync, chmodSync } from "fs";
import { tmpdir } from "os";

const WITH_CREDS = join(import.meta.dir, "..", "scripts", "with-creds");

// Stub `op` binary used by the success-path tests. Handles the three
// subcommands `with-creds` actually invokes:
//   - `op whoami`           → exit 0
//   - `op read <ref>`       → echo a deterministic placeholder
//   - `op run [...] -- cmd` → consume --env-file (recording its body to
//                             $OP_STUB_ENVFILE_LOG if set) then exec cmd.
const OP_STUB = `#!/usr/bin/env bash
set -e
sub="$1"; shift || true
case "$sub" in
  whoami) exit 0 ;;
  read)
    printf 'STUB_SECRET_FOR:%s' "$1"
    ;;
  run)
    env_file=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --env-file=*) env_file="\${1#--env-file=}"; shift ;;
        --env-file) env_file="$2"; shift 2 ;;
        --) shift; break ;;
        *) shift ;;
      esac
    done
    if [[ -n "$env_file" && -n "\${OP_STUB_ENVFILE_LOG:-}" ]]; then
      cat "$env_file" > "$OP_STUB_ENVFILE_LOG"
    elif [[ -n "$env_file" ]]; then
      cat "$env_file" > /dev/null
    fi
    exec "$@"
    ;;
  *) echo "op-stub: unsupported subcommand: $sub" >&2; exit 99 ;;
esac
`;

// Stub that makes \`op whoami\` fail, simulating an unsigned-in session.
const OP_STUB_NOT_SIGNED_IN = `#!/usr/bin/env bash
case "$1" in
  whoami) exit 1 ;;
  *) exit 99 ;;
esac
`;

let stubDir: string;
let envfileLog: string;

beforeAll(() => {
  stubDir = mkdtempSync(join(tmpdir(), "op-stub-"));
  writeFileSync(join(stubDir, "op"), OP_STUB);
  chmodSync(join(stubDir, "op"), 0o755);
  envfileLog = join(stubDir, "envfile.log");
});

afterAll(() => {
  rmSync(stubDir, { recursive: true, force: true });
});

interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

async function runWithCreds(
  args: string[],
  opts: { withOpStub?: boolean; opStub?: string; envFileLog?: string } = {}
): Promise<RunResult> {
  const env: Record<string, string> = {
    ...process.env,
    PATH: opts.withOpStub === false ? "/usr/bin:/bin" : `${stubDir}:${process.env.PATH}`,
  };
  if (opts.envFileLog) env.OP_STUB_ENVFILE_LOG = opts.envFileLog;
  if (opts.opStub) {
    writeFileSync(join(stubDir, "op"), opts.opStub);
    chmodSync(join(stubDir, "op"), 0o755);
  } else {
    writeFileSync(join(stubDir, "op"), OP_STUB);
    chmodSync(join(stubDir, "op"), 0o755);
  }

  const proc = spawn({
    cmd: [WITH_CREDS, ...args],
    stdout: "pipe",
    stderr: "pipe",
    env,
  });
  const exitCode = await proc.exited;
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  return { exitCode, stdout, stderr };
}

describe("Argument parsing and validation", () => {
  test("--help exits 0 and prints usage", async () => {
    const { exitCode, stdout } = await runWithCreds(["--help"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("USAGE:");
    expect(stdout).toContain("--env");
    expect(stdout).toContain("--fd");
  });

  test("-h is the same as --help", async () => {
    const { exitCode, stdout } = await runWithCreds(["-h"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("USAGE:");
  });

  test("no '--' and no command errors with help", async () => {
    const { exitCode, stderr } = await runWithCreds([]);
    expect(exitCode).toBe(2);
    expect(stderr).toContain("missing command");
  });

  test("missing command after '--' errors", async () => {
    const { exitCode, stderr } = await runWithCreds([
      "--env",
      "FOO=op://X/Y/Z",
      "--",
    ]);
    expect(exitCode).toBe(2);
    expect(stderr).toContain("missing command");
  });

  test("no --env or --fd errors with helpful message", async () => {
    const { exitCode, stderr } = await runWithCreds(["--", "echo", "hi"]);
    expect(exitCode).toBe(2);
    expect(stderr).toContain("no credentials requested");
  });

  test("--env without value errors", async () => {
    const { exitCode, stderr } = await runWithCreds(["--env"]);
    expect(exitCode).toBe(2);
    expect(stderr).toContain("--env requires an argument");
  });

  test("--fd without value errors", async () => {
    const { exitCode, stderr } = await runWithCreds(["--fd"]);
    expect(exitCode).toBe(2);
    expect(stderr).toContain("--fd requires an argument");
  });

  test("invalid spec (missing op://) errors", async () => {
    const { exitCode, stderr } = await runWithCreds([
      "--env",
      "FOO=not-a-ref",
      "--",
      "echo",
      "hi",
    ]);
    expect(exitCode).toBe(2);
    expect(stderr).toContain("invalid spec");
  });

  test("invalid name (starts with digit) errors", async () => {
    const { exitCode, stderr } = await runWithCreds([
      "--env",
      "1FOO=op://X/Y/Z",
      "--",
      "echo",
      "hi",
    ]);
    expect(exitCode).toBe(2);
    expect(stderr).toContain("invalid name");
  });

  test("invalid name (contains dash) errors", async () => {
    const { exitCode, stderr } = await runWithCreds([
      "--fd",
      "MY-KEY=op://X/Y/Z",
      "--",
      "echo",
      "hi",
    ]);
    expect(exitCode).toBe(2);
    expect(stderr).toContain("invalid name");
  });

  test("--env=NAME=op://... inline form works", async () => {
    const { exitCode, stdout } = await runWithCreds(
      ["--env=FOO=op://Vault/Item/field", "--", "echo", "ok"],
      { envFileLog: envfileLog }
    );
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe("ok");
  });

  test("unknown flag errors", async () => {
    const { exitCode, stderr } = await runWithCreds(["--bogus", "x"]);
    expect(exitCode).toBe(2);
    expect(stderr).toContain("unknown flag");
  });

  test("placeholder %NAME% without matching --fd errors", async () => {
    const { exitCode, stderr } = await runWithCreds([
      "--fd",
      "GOOD=op://X/Y/Z",
      "--",
      "cat",
      "%MISSING%",
    ]);
    expect(exitCode).toBe(2);
    expect(stderr).toContain("%MISSING%");
    expect(stderr).toContain("no '--fd MISSING=...'");
  });
});

describe("Preflight failures", () => {
  test("missing `op` in PATH exits 127 with install hint", async () => {
    const { exitCode, stderr } = await runWithCreds(
      ["--env", "FOO=op://X/Y/Z", "--", "echo", "hi"],
      { withOpStub: false }
    );
    expect(exitCode).toBe(127);
    expect(stderr).toContain("'op' CLI not found");
  });

  test("`op whoami` failure exits 1 with sign-in hint", async () => {
    const { exitCode, stderr } = await runWithCreds(
      ["--env", "FOO=op://X/Y/Z", "--", "echo", "hi"],
      { opStub: OP_STUB_NOT_SIGNED_IN }
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain("not signed in");
  });
});

describe("Inner command construction", () => {
  test("--env mode runs the inner command and feeds env-file to `op run`", async () => {
    const log = `${envfileLog}.envonly`;
    const { exitCode, stdout } = await runWithCreds(
      [
        "--env",
        "API_KEY=op://Vault/MyApp/api_key",
        "--env",
        "DB_URL=op://Vault/DB/url",
        "--",
        "echo",
        "ran",
      ],
      { envFileLog: log }
    );
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe("ran");

    // The env-file body should be exactly the two refs, one per line.
    const body = await Bun.file(log).text();
    expect(body).toBe(
      "API_KEY=op://Vault/MyApp/api_key\nDB_URL=op://Vault/DB/url\n"
    );
  });

  test("--fd mode replaces %NAME% with a `<(op read ...)` process substitution", async () => {
    // `cat %KEY%` becomes `cat <(op read op://...)`. The stub `op read`
    // echoes a placeholder, so stdout proves the FD path was wired up.
    const { exitCode, stdout } = await runWithCreds([
      "--fd",
      "KEY=op://Vault/SSH/private_key",
      "--",
      "cat",
      "%KEY%",
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("STUB_SECRET_FOR:op://Vault/SSH/private_key");
  });

  test("mixed --env and --fd both work in one invocation", async () => {
    const log = `${envfileLog}.mixed`;
    const { exitCode, stdout } = await runWithCreds(
      [
        "--env",
        "API_KEY=op://Vault/A/key",
        "--fd",
        "CERT=op://Vault/B/cert",
        "--",
        "cat",
        "%CERT%",
      ],
      { envFileLog: log }
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain("STUB_SECRET_FOR:op://Vault/B/cert");
    const body = await Bun.file(log).text();
    expect(body).toBe("API_KEY=op://Vault/A/key\n");
  });

  test("non-placeholder arguments containing shell metachars are quoted, not executed", async () => {
    // If quoting were broken, the `; touch <marker>` would create the
    // marker file. We assert the marker does NOT exist after the run.
    const marker = join(stubDir, "pwn-marker");
    const dangerous = `safe; touch ${marker}`;
    const { exitCode, stdout } = await runWithCreds([
      "--env",
      "FOO=op://X/Y/Z",
      "--",
      "echo",
      dangerous,
    ]);
    expect(exitCode).toBe(0);
    // echo should output the literal string, not execute the trailing touch.
    expect(stdout.trim()).toBe(dangerous);
    expect(await Bun.file(marker).exists()).toBe(false);
  });
});
