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
| `commit [message]` | Mode-aware alias for the default action — `update` in normal mode, `checkpoint` in stacked mode. Same as bare `/stacked-pr-gemini`. |
| `setup` | Show the current mode and switch between `normal` and `stacked` (writes `git config stacked-pr-gemini.mode`, global by default). |
| `update [base-branch]` | Commit + push + update the current branch's PR (or open one). Doesn't change an existing PR's base. The normal-mode default. |
| `log` | Read-only. In normal mode show the current branch's PR; in stacked mode print the stack tree. |
| `merge [--merge\|--rebase\|--squash] [--all] [--dry-run]` | In normal mode merge the current branch's single PR. In stacked mode land the stack bottom-up with retarget verification. Refuses `--delete-branch` on stacks. |
| `checkpoint [slice description]` | Cut current diff as the next stacked branch. Local-only on the git-stack path (publishes nothing); the `gh`-fallback path still publishes eagerly. The stacked-mode default. |
| `submit` | Publish point: push the whole stack (force-with-lease), open/update one PR per branch, and stamp the `[<name> N/M]` title markers. Requires `git stack`. |
| `sync [--no-push]` | Fetch trunk and rebase every branch in the stack onto the updated tip. Force-push-with-lease unless `--no-push`. |

See [references/recovery.md](references/recovery.md) if a `--delete-branch`
mishap has already auto-closed a child PR.

## Bundled AfterTool hook

This skill also ships a diff-size nudge hook. It fires after every
`replace`/`write_file` tool call and emits a soft
reminder to run `/stacked-pr-gemini` when the uncommitted diff crosses size/file
thresholds — so you land a focused PR (a stacked checkpoint in stacked
mode) before the diff grows unwieldy.

The hook is wired up by the bundled `scripts/install.sh` (see Install
below). See [references/nudge.md](references/nudge.md) for thresholds,
env-var overrides, and manual wiring as an alternative.

If you also have the standalone `pr-size-nudge` skill installed, remove
its `settings.json` hook entry before adding this one — otherwise both
fire and you'll get double nudges. The bundled `install.sh` prints a
warning when it detects an existing pr-size-nudge entry.

See [SKILL.md](./SKILL.md) for the dispatcher and the per-subcommand
references for the full workflows.

## Install

```sh
npx skills add zcaceres/skills -s stacked-pr-gemini-gemini
~/.gemini/skills/stacked-pr-gemini/scripts/install.sh
```

The second step wires the bundled AfterTool nudge hook into
`~/.gemini/settings.json` so it fires on every matching tool call,
not just when the skill is active in context. The script is
idempotent, backs up the target file with a timestamp, and is a
no-op if the hook is already wired. The script self-locates, so it
works whether the skill was installed at user scope or project
scope. Flags: `--project`, `--target PATH`. Requires `jq`. Skip
this step if you only want the slash command and don't want the
nudge.

To work in stacked mode by default everywhere:

```sh
git config --global stacked-pr-gemini.mode stacked
```

Optional but recommended for stacked mode:

- `git stack` CLI — install separately from
  [`zcaceres/git-stack`](https://github.com/zcaceres/git-stack) releases.
  Without it, stacked mode falls back to `gh` + `git` (and `submit`,
  the whole-stack push, is unavailable).
