# stacked-pr-gemini

A single Gemini CLI skill that bundles the full stacked-PR workflow.
This is a dedicated fork of the `stacked-pr` skill optimized specifically for **Gemini CLI** instead of Claude Code.

### Why is this separate from `stacked-pr`?
Gemini CLI has different hook configurations compared to Claude Code:
1. **Hook Event Name:** Gemini CLI uses `AfterTool` instead of `PostToolUse`. Declare `PostToolUse` in Gemini CLI, and it will fail with `Invalid hook event name: "PostToolUse"`.
2. **Tool Matchers:** Gemini CLI's file-modifying tools are named `replace` and `write_file` (instead of Claude's `Edit`, `Write`, `MultiEdit`, `NotebookEdit`).

This `stacked-pr-gemini` skill has been fully customized to run as `AfterTool` matching `replace|write_file`, preventing any warnings and ensuring that the diff nudge correctly triggers.

Detects whether the
[`git-stack`](https://github.com/zcaceres/git-stack) CLI is installed —
if yes, uses its primitives; otherwise falls back to plain `gh` + `git`.

**Usage:** `/stacked-pr-gemini [subcommand] [args]`

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

## Bundled AfterTool hook

This skill also ships the diff-size nudge hook. It fires after every `replace`/`write_file` tool call and emits a soft reminder to run `/stacked-pr-gemini checkpoint` when the uncommitted diff crosses size/file thresholds.

The hook is wired up by the bundled `scripts/install.sh` (see Install
below). See [references/nudge.md](references/nudge.md) for thresholds,
env-var overrides, and manual wiring as an alternative.

`/stacked-pr-gemini` alone runs `checkpoint`. `/stacked-pr-gemini "fix the retry loop"`
also runs `checkpoint` with that as the slice description — the
`checkpoint` keyword is optional for the default action.

See [SKILL.md](./SKILL.md) for the dispatcher and the per-subcommand
references for the full workflows.

## Install

```sh
npx skills add zcaceres/skills -s stacked-pr-gemini
~/.gemini/skills/stacked-pr-gemini/scripts/install.sh
```

The second step wires the bundled AfterTool nudge hook into
`~/.gemini/settings.json` so it fires on every matching tool call,
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
