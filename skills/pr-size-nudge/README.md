# pr-size-nudge

PostToolUse hook for Claude Code that injects a soft system-reminder
when the uncommitted diff in the current repo crosses size/file
thresholds without a commit. Tells the agent to consider
[`/checkpoint`](../checkpoint/) to land the slice as a stacked PR.

Non-blocking by design — never exits non-zero, never returns block
payloads. Reads `git diff --numstat HEAD` + `git status --porcelain`
under a 300 ms subprocess timeout; state is kept in
`~/.claude/state/pr-size-nudge.json` with a 30-minute cooldown and
re-fire deltas (+150 lines / +3 files).

Pre-built Bun binaries for macOS arm64, Linux x64, and Windows x64 ship
in the published tarball.

See [SKILL.md](./SKILL.md) for thresholds, env vars, default
exclusions, manual wiring, and how it works internally.

## Develop

```sh
bun install                                   # at the monorepo root
bun test --cwd skills/pr-size-nudge           # globToRegex / isExcluded / shouldFire / message
bun run dev <<<'{"cwd":"/","session_id":"x"}' # smoke-test the hook
```

## Build binaries

```sh
bun run build:all     # produces scripts/bin/pr-size-nudge-{linux-x64,darwin-arm64,windows-x64.exe}
```

The release pipeline runs `bun run build:all` (via `fetch-tools`) before
tarballing, so binaries land in the published artifact even though
they're gitignored.

## Install

```sh
npx skills add zcaceres/skills -s pr-size-nudge
~/.claude/skills/pr-size-nudge/scripts/install.sh
```

The bundled `install.sh` idempotently wires the hook into
`~/.claude/settings.json` (with timestamped backup) so the nudge fires
after every Edit/Write/MultiEdit/NotebookEdit call, not just while this
skill is loaded. Requires `jq`. See [SKILL.md](./SKILL.md#install) for
why two steps are needed and for manual wiring as an alternative.

Best paired with [`checkpoint`](../checkpoint/) — the nudge points the
agent at that slash command.

## Origin

Ported from
[`zcaceres/claude-stacked-prs/src/pr-size-nudge.ts`](https://github.com/zcaceres/claude-stacked-prs/blob/main/src/pr-size-nudge.ts)
into this monorepo as a standalone hook skill. Source preserved
verbatim; tests preserved verbatim (with import path adjusted from
`./pr-size-nudge` to `../scripts/index`).
