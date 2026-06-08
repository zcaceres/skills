# safety-rm-rf-guard

PreToolUse hook for Claude Code that blocks destructive file deletion and
redirects to the `trash` CLI. Pre-built binaries for macOS arm64, Linux x64,
and Windows x64 ship in the published tarball.

See [SKILL.md](./SKILL.md) for the full reference: blocked patterns, install
script, manual wiring, and how it works.

## Install

```sh
npx skills add zcaceres/skills -s safety-rm-rf-guard
~/.claude/skills/safety-rm-rf-guard/scripts/install.sh
```

The bundled `install.sh` idempotently wires the hook into
`~/.claude/settings.json` (with timestamped backup) so it fires on every
Bash call, not just while this skill is loaded. Requires `jq`. See
[SKILL.md](./SKILL.md#install) for why two steps are needed and for
manual wiring as an alternative.

## Develop

```sh
bun install           # at the monorepo root
bun test              # 30+ cases covering bypass attempts
bun run dev <<<'{"tool_input":{"command":"rm -rf /"}}'   # smoke test the hook
```

## Build binaries

```sh
bun run build:all     # produces scripts/bin/safety-rm-rf-guard-{linux-x64,darwin-arm64,windows-x64.exe}
```

The release pipeline runs `bun run build:all` (via `fetch-tools`) before
tarballing, so binaries land in the published artifact even though they're
gitignored.

## Origin

Ported from [`zcaceres/claude-rm-rf`](https://github.com/zcaceres/claude-rm-rf)
into this monorepo. Behavior and test coverage are preserved.
