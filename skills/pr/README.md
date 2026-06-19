# pr

A single Claude Code skill for committing your work and opening pull
requests with `/pr`. It has two modes:

- **normal** (default) — commit the changes you made in this
  conversation, push, and open a single PR against the trunk
  (`main`/`master`). The everyday "ship my work" flow.
- **stacked** — `/pr` becomes a stacked-PR workflow: each `/pr` cuts the
  current diff onto a new branch stacked on the last, plus subcommands to
  push the whole stack, rebase onto trunk, and merge bottom-up.

Normal mode is the default. Switch with [`/pr setup`](references/setup.md)
(or `git config --global pr.mode stacked`).

In stacked mode it detects whether the
[`git-stack`](https://github.com/zcaceres/git-stack) CLI is installed —
if yes, uses its primitives; otherwise falls back to plain `gh` + `git`.

**Usage:** `/pr [subcommand] [args]`

## Modes

`/pr` with no subcommand — or `/pr commit [message]` — does the everyday
action for the active mode:

- **normal** → commit + push + open/update a single PR against the trunk.
- **stacked** → checkpoint: cut the current diff as the next stacked
  branch + PR.

The mode lives in `git config pr.mode` (a local value overrides a global
one; unset means normal). Named subcommands below work in either mode.

## Subcommands

| Subcommand | What it does |
|---|---|
| `commit [message]` | Mode-aware alias for the default action — `update` in normal mode, `checkpoint` in stacked mode. Same as bare `/pr`. |
| `setup` | Show the current mode and switch between `normal` and `stacked` (writes `git config pr.mode`, global by default). |
| `update [base-branch]` | Commit + push + update the current branch's PR (or open one). Doesn't change an existing PR's base. The normal-mode default. |
| `log` | Read-only. In normal mode show the current branch's PR; in stacked mode print the stack tree. |
| `merge [--merge\|--rebase\|--squash] [--all] [--dry-run]` | In normal mode merge the current branch's single PR. In stacked mode land the stack bottom-up with retarget verification. Refuses `--delete-branch` on stacks. |
| `checkpoint [slice description]` | Cut current diff as the next stacked branch + PR. The stacked-mode default. |
| `submit` | Push the whole stack (force-with-lease) and create/update one PR per branch. Requires `git stack`. |
| `sync [--no-push]` | Fetch trunk and rebase every branch in the stack onto the updated tip. Force-push-with-lease unless `--no-push`. |

See [references/recovery.md](references/recovery.md) if a `--delete-branch`
mishap has already auto-closed a child PR.

## Bundled PostToolUse hook

This skill also ships a diff-size nudge hook. It fires after every
`Edit`/`Write`/`MultiEdit`/`NotebookEdit` tool call and emits a soft
reminder to run `/pr` when the uncommitted diff crosses size/file
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
npx skills add zcaceres/skills -s pr
~/.claude/skills/pr/scripts/install.sh
```

The second step wires the bundled PostToolUse nudge hook into
`~/.claude/settings.json` so it fires on every matching tool call,
not just when the skill is active in context. The script is
idempotent, backs up the target file with a timestamp, and is a
no-op if the hook is already wired. The script self-locates, so it
works whether the skill was installed at user scope or project
scope. Flags: `--project`, `--target PATH`. Requires `jq`. Skip
this step if you only want the slash command and don't want the
nudge.

To work in stacked mode by default everywhere:

```sh
git config --global pr.mode stacked
```

Optional but recommended for stacked mode:

- `git stack` CLI — install separately from
  [`zcaceres/git-stack`](https://github.com/zcaceres/git-stack) releases.
  Without it, stacked mode falls back to `gh` + `git` (and `submit`,
  the whole-stack push, is unavailable).
