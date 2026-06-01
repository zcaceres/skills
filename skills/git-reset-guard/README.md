# git-reset-guard

PreToolUse hook for Claude Code that blocks destructive git commands
(`reset --hard`, `push --force`, `clean -f`, `checkout <path>`, `branch -D`,
`stash drop/clear`, `worktree remove --force`) and points at safer
alternatives. Pre-built binaries for macOS arm64, Linux x64, and Windows x64
ship in the published tarball.

See [SKILL.md](./SKILL.md) for the full reference: blocked patterns, manual
wiring, and how it works.

## Agent support

Works on **Claude Code** and **Codex CLI**. **Not supported** on Antigravity
CLI — Antigravity has no hook system, so guard-style enforcement is impossible
there. See [SKILL.md](./SKILL.md) for per-agent install instructions.

## Develop

```sh
bun install           # at the monorepo root
bun test              # exhaustive bypass-attempt coverage
bun run dev <<<'{"tool_input":{"command":"git reset --hard"}}'   # smoke test
```

## Build binaries

```sh
bun run build:all     # produces scripts/bin/git-reset-guard-{linux-x64,darwin-arm64,windows-x64.exe}
```

The release pipeline runs `bun run build:all` (via `fetch-tools`) before
tarballing, so binaries land in the published artifact even though they're
gitignored.

## Origin

Ported from [`zcaceres/claude-git-reset`](https://github.com/zcaceres/claude-git-reset)
into this monorepo. Behavior and test coverage are preserved.
