# stacked-pr

A single Claude Code skill that bundles the full stacked-PR workflow.
Supersedes the three sibling skills (`checkpoint`, `commit-push-pr`,
`pr-size-nudge`) that previously had to be installed separately.

Detects whether the
[`git-stack`](https://github.com/zcaceres/git-stack) CLI is installed —
if yes, uses its primitives; otherwise falls back to plain `gh` + `git`.

**Usage:** `/stacked-pr [subcommand] [args]`

## Subcommands

| Subcommand | What it does |
|---|---|
| `checkpoint [slice description]` | Cut current diff as the next stacked branch + PR. Default when no subcommand is given. |
| `update [base-branch]` | Commit + push + update the current branch's PR (or open one). Doesn't change an existing PR's base. |
| `submit` | Push the whole stack (force-with-lease) and create/update one PR per branch. Requires `git stack`. |
| `log` | Read-only. Print the stack tree, each branch's PR, base, and state. Falls back to `gh pr list` when `git stack` isn't installed. |
| `sync [--no-push]` | Fetch trunk and rebase every branch in the stack onto the updated tip. Force-push-with-lease unless `--no-push`. |
| `merge [--merge\|--rebase\|--squash] [--all] [--dry-run]` | Land the stack bottom-up with retarget verification between merges. Default strategy `--merge` preserves SHAs. `--rebase`/`--squash` rewrite SHAs and trigger the rebase-onto-main dance for child PRs. Refuses `--delete-branch`. |

See [references/recovery.md](references/recovery.md) if a `--delete-branch`
mishap has already auto-closed a child PR.

## Bundled PostToolUse hook

This skill also ships the diff-size nudge hook (formerly the
`pr-size-nudge` skill). It fires after every `Edit`/`Write`/
`MultiEdit`/`NotebookEdit` tool call and emits a soft reminder to
run `/stacked-pr checkpoint` when the uncommitted diff crosses
size/file thresholds.

The hook is wired up by the bundled `scripts/install.sh` (see Install
below). See [references/nudge.md](references/nudge.md) for thresholds,
env-var overrides, and manual wiring as an alternative.

If you're migrating from the standalone `pr-size-nudge` skill, remove
its `settings.json` hook entry before adding this one — otherwise
both fire and you'll get double nudges. The bundled `install.sh`
prints a warning when it detects an existing pr-size-nudge entry.

`/stacked-pr` alone runs `checkpoint`. `/stacked-pr "fix the retry loop"`
also runs `checkpoint` with that as the slice description — the
`checkpoint` keyword is optional for the default action.

See [SKILL.md](./SKILL.md) for the dispatcher and the per-subcommand
references for the full workflows.

## Install

```sh
npx skills add zcaceres/skills -s stacked-pr
~/.claude/skills/stacked-pr/scripts/install.sh
```

The second step wires the bundled PostToolUse nudge hook into
`~/.claude/settings.json` so it fires on every matching tool call,
not just when the skill is active in context. The script is
idempotent, backs up the target file with a timestamp, and is a
no-op if the hook is already wired. The script self-locates, so it
works whether the skill was installed at user scope or project
scope. Flags: `--project`, `--target PATH`. Requires `jq`. Skip
this step if you only want the slash commands and don't want the
nudge.

Optional but recommended:

- `git stack` CLI — install separately from
  [`zcaceres/git-stack`](https://github.com/zcaceres/git-stack) releases.
  Without it, the skill falls back to `gh` + `git`.

## Origin

Consolidates these previously-separate skills into one distributable unit:

- [`checkpoint`](../checkpoint/) → `/stacked-pr checkpoint`
- [`commit-push-pr`](../commit-push-pr/) → `/stacked-pr update`
- [`pr-size-nudge`](../pr-size-nudge/) → bundled PostToolUse hook (see
  [references/nudge.md](references/nudge.md))

The originals remain installable for one release cycle, then will be
removed in favor of this consolidated skill.
