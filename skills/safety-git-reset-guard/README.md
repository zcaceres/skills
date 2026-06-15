# safety-git-reset-guard

PreToolUse hook for Claude Code (and Codex CLI) that blocks destructive git
commands (`reset --hard`, `push --force`, `clean -f`, `checkout <path>`,
`branch -D`, `stash drop/clear`, `worktree remove --force`) and points at safer
alternatives. It blocks via the `permissionDecision: "deny"` stdout contract
both agents honor. Pre-built binaries for macOS arm64, Linux x64, and Windows
x64 ship in the published tarball.

See [SKILL.md](./SKILL.md) for the full reference: blocked patterns, install
script, manual wiring, the [Codex CLI](./SKILL.md#codex-cli) setup, and how it
works.

## Install

```sh
npx skills add zcaceres/skills -s safety-git-reset-guard
~/.claude/skills/safety-git-reset-guard/scripts/install.sh
```

The bundled `install.sh` idempotently wires the hook into
`~/.claude/settings.json` (with timestamped backup) so it fires on every
Bash call, not just while this skill is loaded. Requires `jq`. See
[SKILL.md](./SKILL.md#install) for why two steps are needed and for
manual wiring as an alternative.

## Develop

```sh
bun install           # at the monorepo root
bun test              # exhaustive bypass-attempt coverage
bun run dev <<<'{"tool_input":{"command":"git reset --hard"}}'   # smoke test
```

## Build binaries

```sh
bun run build:all     # produces scripts/bin/safety-git-reset-guard-{linux-x64,darwin-arm64,windows-x64.exe}
```

The release pipeline runs `bun run build:all` (via `fetch-tools`) before
tarballing, so binaries land in the published artifact even though they're
gitignored.

## Origin

Ported from [`zcaceres/claude-git-reset`](https://github.com/zcaceres/claude-git-reset)
into this monorepo. Behavior and test coverage are preserved.
