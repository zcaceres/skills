---
name: safety-op-creds
description: Fetch credentials from 1Password via the `op` CLI and feed them to programs through bash process substitution (/dev/fd/N file descriptors) or `op run` env vars, so secrets never touch disk or the agent's tool output. Ships a `with-creds` wrapper plus a PreToolUse hook that blocks bare `op read` and other secret-printing op subcommands.
hooks:
  PreToolUse:
    - matcher: "Bash"
      type: command
      command: "~/.claude/skills/safety-op-creds/scripts/run.sh"
---

# safety-op-creds

The sanctioned alternative to `.env` files: store credentials in 1Password,
fetch them at runtime via the `op` CLI, and pass them to the consuming
program through a kernel pipe (`/dev/fd/N` via bash process substitution)
or as masked environment variables (via `op run`). Secrets never land on
disk and never appear in the agent's tool output.

Two pieces:

1. **`with-creds` wrapper** — a small bash script in `scripts/with-creds`
   that takes one or more `--env NAME=op://...` and/or `--fd NAME=op://...`
   flags plus a target command, then execs that command with the secrets
   wired in via process substitution or `op run`.
2. **PreToolUse hook** — blocks Bash tool calls that would leak secrets:
   bare `op read`, `op item get --reveal`, `op item get --format=json`,
   `op inject` to stdout/file, and subshell/eval bypasses of any of the
   above.

Pairs naturally with the `safety-dotenv-guard` skill: `safety-dotenv-guard`
prevents the wrong pattern (reading `.env`); `safety-op-creds` enables the right
one.

## Why this exists

`.env` files on disk are the wrong default for AI-agent workflows:

- Once an agent reads `.env`, the values live in its context and can leak
  into transcripts, summaries, and PR descriptions.
- A `.env` accidentally committed to git is the canonical secret-leak
  incident; a `.env` in `~/projects/` is one `grep -r SECRET ~/` away from
  a different incident.

The fix is to keep the secret out of the filesystem (and out of the
agent's stdout). 1Password stores the value; the `op` CLI fetches it on
demand; bash process substitution or `op run` delivers it to the consumer
through a kernel pipe or a child-process env var. The agent never sees
the literal bytes.

## How the FD trick works

When bash sees `<(command)`, it:

1. Forks `command` as a subprocess and connects its stdout to a pipe.
2. Substitutes the `<(command)` token in the surrounding command line
   with a path like `/dev/fd/63`.
3. The consumer opens that path and reads bytes that came from the
   subprocess's stdout.

The "file" at `/dev/fd/63` is a handle on the running pipe — not an
inode in any filesystem. The secret lives in three places only: the
`op` subprocess's memory, the kernel pipe buffer, and the consumer
process's memory. It is never written to disk and never appears on the
agent's stdout, because the agent's tool output captures the *outer*
command's stdout, not what flows through the inner FD.

`op run --env-file=...` works similarly for env-var consumers: `op`
resolves `op://...` references inline, sets the resulting env vars in
the child process's memory, and execs the target. The masking in `op
run` additionally redacts secret values that the child happens to print
to stdout/stderr, replacing them with `<concealed by 1Password>`.

## Usage

### Env-var consumers (`--env`)

For programs that read credentials from environment variables:

```sh
with-creds --env AWS_ACCESS_KEY_ID=op://Vault/AWS/access_key_id \
           --env AWS_SECRET_ACCESS_KEY=op://Vault/AWS/secret_access_key \
           -- aws s3 ls

with-creds --env DATABASE_URL=op://Personal/Postgres/connection_string \
           -- psql

with-creds --env GITHUB_TOKEN=op://Work/GitHub/token \
           -- gh repo list
```

Under the hood: `op run` resolves the refs, sets the env vars in the
child process only, and masks any secret values that appear in the
child's stdout/stderr.

### File-path consumers (`--fd`)

For programs that take a path to a key file, certificate, or token file:

```sh
with-creds --fd KEY=op://Personal/SSH/private_key \
           -- ssh -i %KEY% user@host

with-creds --fd CERT=op://Work/Postgres/client_cert \
           -- psql --set=sslcert=%CERT% "host=db.internal user=app"
```

`%NAME%` must be the *whole* argument. The wrapper replaces each whole-
argument `%NAME%` with the corresponding `<(op read "op://...")` process
substitution and execs via `bash -c`. For embedded uses like
`--cert=%CERT%`, fall back to plain bash:

```sh
some-tool --cert=<(op read "op://Work/MyApp/cert")
```

### Mixing both modes

When the program reads its env vars natively (e.g. `aws`, `gh`, `psql`),
`--env` and `--fd` compose cleanly:

```sh
with-creds --env AWS_ACCESS_KEY_ID=op://Vault/AWS/access_key_id \
           --env AWS_SECRET_ACCESS_KEY=op://Vault/AWS/secret_access_key \
           --fd  CA=op://Vault/AWS/ca_bundle \
           -- aws --ca-bundle %CA% s3 ls
```

#### Gotcha: `$VAR` interpolation needs an inner shell

`--env` sets the variable in the *child* process. If the value has to
be spliced into an argv token (curl's `Authorization` header is the
canonical case), `$VAR` written directly in the command won't work:
the parent shell expands `$VAR` *before* `with-creds` runs (so the
secret is empty), and `with-creds` argv-quotes its arguments before
exec, so a literal `$VAR` can't be expanded by the child either.

Wrap the consumer in `sh -c` so the *inner* shell (which inherits the
env from `op run`) does the expansion:

```sh
with-creds --env API_KEY=op://Work/Service/api_key \
           --fd  CA=op://Work/Service/ca_bundle \
           -- sh -c 'curl --cacert "$1" -H "Authorization: Bearer $API_KEY" https://api.example.com' _ %CA%
```

`%CA%` is replaced by `with-creds` with the file-descriptor path and
arrives as `$1` inside `sh -c`. `$API_KEY` is interpolated by the
inner shell from its own environment, where `op run` placed it.

### Plain bash, no wrapper

The wrapper is convenience; the underlying patterns work directly:

```sh
# Process substitution — for file-path consumers
ssh -i <(op read "op://Personal/SSH/private_key") user@host

# `op run` — for env-var consumers
op run --env-file=secrets.template -- my-app
```

Both forms pass the hook unchanged.

## What the hook blocks

The hook only matches `Bash` tool calls (other tools pass through).
Within Bash, it blocks:

- **Bare `op read`** — anywhere except inside `<( ... )`.
  - `op read "op://Vault/X/y"` — would print the secret to the agent.
  - `op read "op://..." > /tmp/x` — would write the secret to disk.
  - `op read "op://..." | tee log` — would duplicate the secret to stdout.
  - `VAR=$(op read "op://...")` — captures the secret into shell memory,
    easy to accidentally echo. Use `with-creds` or `<( ... )` instead.
  - `` `op read "op://..."` `` — same as above (backtick form).
- **Bare `op inject`** — anywhere except inside `<( ... )`. Resolves
  `op://...` refs in a template and writes the result to stdout or to
  `-o FILE`, both of which expose secrets.
- **`op item get … --reveal`** — explicitly prints secret fields.
- **`op item get … --format json`** (or `--format=json`) — JSON output
  includes secret values inline.
- **Subshell / eval bypasses** — `sh -c 'op read …'`,
  `bash -c "op item get --reveal …"`, `eval 'op inject …'`. The hook
  scans the raw command before stripping quotes, so hiding the bad
  pattern inside a quoted `-c` arg doesn't help.

## What the hook allows

- **`op read` inside `<( ... )`** — process substitution; the secret
  flows through `/dev/fd/N`, not stdout.
- **`op inject` inside `<( ... )`** — same reasoning; resolved template
  flows through the FD.
- **`op run`** — designed for safe secret consumption; masks values in
  the child's output by default.
- **`op signin`, `op whoami`, `op vault list`, `op item list`,
  `op account …`** — no secret values in their output.
- **Plain `op item get <item>`** — default output is metadata only; secret
  fields are concealed unless `--reveal` or `--format=json` is passed.
- **Bundled `with-creds` invocations** — the command text the agent
  produces contains no literal `op read`, so it passes the scan
  naturally; the wrapper handles secrets internally.
- **Legitimate quoted mentions** — `git commit -m "doc op read usage"`,
  `echo "op read example"`, `grep -E "op read"`. The hook strips quoted
  substrings before scanning (the raw-bypass scan still catches the
  subshell variants of the same hiding trick).
- **Every non-Bash tool** — `Read`, `Edit`, `Write`, `Grep`, `Glob`, etc.
  pass through untouched.

## Known limitations

Honest about what this skill **cannot** catch:

- **Custom wrappers and aliases.** A user-defined `1pass-fetch` function
  that calls `op read` internally bypasses the hook — only the outer
  command name is visible. The same applies to compiled binaries that
  invoke `op`.
- **Blind FDs.** A program could open `/dev/stdin` from inside a `<(op
  read …)` and write the bytes elsewhere. The hook can't observe child-
  process behavior.
- **Masking gaps in FD mode.** `op run` masks secrets in the child's
  output. Process substitution does *not* — the secret bytes flow raw
  through the FD, and if the child decides to echo them, they appear in
  stdout. The hook does not (and cannot, generally) inspect what the
  child does with the FD's bytes.
- **Encoded references.** `op read $(echo b3A6Ly8... | base64 -d)`
  hides the reference behind a decode. The outer command is still
  blocked (it contains `op read`), but more exotic constructions might
  evade the regex.
- **Concurrent processes.** The hook runs on the Claude Code tool boundary
  only; a separate shell session can run anything.

Treat this as **defense in depth**, not an airtight guarantee. Pair it
with `.gitignore` hygiene, OS keychain protection of the 1Password
session, the `safety-dotenv-guard` skill, and an honest threat model.

## Install

The `hooks:` block in the frontmatter above auto-wires the hook on
skill load when installed at the standard personal-install location
(`~/.claude/skills/safety-op-creds/`). If you install elsewhere, paste this
into `~/.claude/settings.json` or your project's `.claude/settings.json`
with `<path>` set to the unpacked skill's absolute path:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "<path>/safety-op-creds/scripts/run.sh" }
        ]
      }
    ]
  }
}
```

On Windows, point at `scripts\\run.cmd` instead.

For convenient use, symlink the wrapper onto your PATH:

```sh
ln -s ~/.claude/skills/safety-op-creds/scripts/with-creds ~/.local/bin/with-creds
```

Verify the hook is wired by asking Claude Code to run
`op read "op://Vault/Item/field"`; the hook prints `BLOCKED:` on stderr
and exit-2s.

## Prerequisites

- **`op` CLI** version 2.x or later
  ([install](https://1password.com/downloads/command-line/)). The
  wrapper calls `op whoami` as a preflight; if it returns non-zero,
  the wrapper exits with a helpful error.
- **Signed in.** On macOS, the recommended setup is Touch ID unlock via
  the 1Password app — no master password lives on disk. Run
  `op signin` once per session if biometric unlock isn't enabled.
- **Bun runtime** (only required to rebuild the hook binary from
  source). Pre-built binaries for macOS arm64, Linux x64, and Windows
  x64 ship in `scripts/bin/`.

## Out of scope for v1

- **Service-account tokens** (`OP_SERVICE_ACCOUNT_TOKEN`). The token
  itself is a credential and should live in the macOS Keychain, fetched
  via `security find-generic-password`. A future revision may add this.
- **1Password Connect server.** Useful for teams; ask if you need it.
- **`op` CLI plugin proxies.** The `op` CLI can shim other tools
  (e.g. `op plugin run -- gh`) so they pull secrets transparently. The
  hook only inspects the literal command; plugin behavior is opaque to
  it.

## How it works

1. Claude Code invokes `scripts/run.sh` before every `Bash` tool call.
2. `run.sh` picks the right bundled binary from `scripts/bin/` for the
   host OS/arch (`safety-op-creds-darwin-arm64`, `safety-op-creds-linux-x64`, or
   `safety-op-creds-windows-x64.exe`).
3. The binary reads the JSON tool payload from stdin and inspects
   `tool_input.command`.
4. The command is first scanned raw for subshell/eval bypass patterns
   (`bash -c '… op read …'`, `eval '… op inject …'`, etc.).
5. Then quoted substrings are stripped so legitimate mentions in commit
   messages, echo strings, and grep patterns don't trip the scan.
6. `<(op read …)` and `<(op inject …)` substrings are then masked out
   — these are the sanctioned consumption patterns.
7. Anything left matching `op read`, `op inject`, `op item get …
   --reveal`, or `op item get … --format json` triggers a block: exit 2
   with an explanatory stderr message that points the agent at
   `with-creds`, `<( ... )`, or `op run` as the safe alternatives.
