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

`merge` lands in the next PR in this consolidation stack. The
PostToolUse hook (`pr-size-nudge`) joins this skill in the final PR.

`/stacked-pr` alone runs `checkpoint`. `/stacked-pr "fix the retry loop"`
also runs `checkpoint` with that as the slice description — the
`checkpoint` keyword is optional for the default action.

See [SKILL.md](./SKILL.md) for the dispatcher and the per-subcommand
references for the full workflows.

## Install

```sh
npx skills add zcaceres/skills -s stacked-pr
```

Optional but recommended:

- `git stack` CLI — install separately from
  [`zcaceres/git-stack`](https://github.com/zcaceres/git-stack) releases.
  Without it, the skill falls back to `gh` + `git`.

## Origin

Consolidates these previously-separate skills into one distributable unit:

- [`checkpoint`](../checkpoint/) → `/stacked-pr checkpoint`
- [`commit-push-pr`](../commit-push-pr/) → `/stacked-pr update`
- [`pr-size-nudge`](../pr-size-nudge/) → bundled hook (added in a later PR)

The originals remain installable for one release cycle, then will be
removed in favor of this consolidated skill.
