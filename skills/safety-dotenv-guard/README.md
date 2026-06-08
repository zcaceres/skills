# safety-dotenv-guard

PreToolUse hook for Claude Code that blocks `Read`, `Bash`, `Grep`, and
`Glob` tool calls touching `.env` files so secrets never enter the agent's
context. Allows the usual template names (`.env.example`, `.env.sample`,
`.env.template`, `.env.dist`). Pre-built binaries for macOS arm64, Linux
x64, and Windows x64 ship in the published tarball.

See [SKILL.md](./SKILL.md) for the full reference: blocked patterns, install
script, manual wiring, and how it works.

## Install

```sh
npx skills add zcaceres/skills -s safety-dotenv-guard
~/.claude/skills/safety-dotenv-guard/scripts/install.sh
```

The bundled `install.sh` idempotently wires the hook into
`~/.claude/settings.json` (with timestamped backup) so it fires on every
Read/Bash/Grep/Glob call, not just while this skill is loaded. Requires
`jq`. See [SKILL.md](./SKILL.md#install) for why two steps are needed
and for manual wiring as an alternative.

## Develop

```sh
bun install           # at the monorepo root
bun test              # blocked + allowed cases across all 4 tools
bun run dev <<<'{"tool_name":"Read","tool_input":{"file_path":"/repo/.env"}}'   # smoke test
```

## Build binaries

```sh
bun run build:all     # produces scripts/bin/safety-dotenv-guard-{linux-x64,darwin-arm64,windows-x64.exe}
```

The release pipeline runs `bun run build:all` (via `fetch-tools`) before
tarballing, so binaries land in the published artifact even though they're
gitignored.
