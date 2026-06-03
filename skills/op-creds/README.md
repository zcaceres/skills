# op-creds

A Claude Code skill (and standalone wrapper) for using credentials stored
in 1Password without ever writing them to disk or letting them appear in
the agent's tool output.

Two pieces:

1. **`with-creds`** — a bash wrapper that fetches secrets via the `op`
   CLI and feeds them to a target program. Two modes:
   - **`--env NAME=op://...`** sets env vars in the child process (via
     `op run`), with secret masking in the child's stdout/stderr.
   - **`--fd NAME=op://...`** exposes the secret as a `/dev/fd/N` path
     (via bash process substitution) for tools that need a file.
2. **PreToolUse hook** — blocks bare `op read`, `op item get --reveal`,
   and other op subcommands whose stdout would leak secrets into the
   agent's transcript. Allows `op read` inside `<( ... )`, `op run`,
   the `with-creds` wrapper, and read-only listing commands.

See [SKILL.md](./SKILL.md) for the full reference: usage examples,
blocked/allowed patterns, install steps, and known limitations.

## Develop

```sh
bun install           # at the monorepo root
bun test              # hook block/allow matrix
bun run dev <<<'{"tool_name":"Bash","tool_input":{"command":"op read \"op://x/y/z\""}}'
```

## Build binaries

```sh
bun run build:all     # produces scripts/bin/op-creds-{linux-x64,darwin-arm64,windows-x64.exe}
```

The release pipeline runs `bun run build:all` (via `fetch-tools`) before
tarballing, so binaries land in the published artifact even though they're
gitignored by the monorepo root.
