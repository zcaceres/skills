# pr

A single Claude Code skill for committing your work and opening pull
requests with `/pr`. It has two modes:

- **normal** (default) — commit the changes you made in this
  conversation, push, and open a single PR against the trunk
  (`main`/`master`). The everyday "ship my work" flow.
- **stacked** — `/pr` becomes a stacked-PR workflow: each `/pr` cuts the
  current diff onto a new branch stacked on the last (built **locally**,
  with `git stack`), then you publish the finished stack all at once with
  `submit` — no trickle of partial PRs on GitHub. Plus subcommands to
  rebase onto trunk and merge bottom-up. Published PRs get a
  `[<name> N/M]` title marker (e.g. `[ENG-456 2/4] …`, named after the
  ticket when the branch carries one, else a slug) so GitHub shows at a
  glance which stack a PR is in and where it sits — see
  [references/title-convention.md](references/title-convention.md).

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

## Drafts

Any PR `/pr` **creates** can be a draft, independently of the mode:

- **Per invocation** — add `--draft` (or `-d`) to any `/pr` command:
  `/pr --draft`, `/pr update --draft`, `/pr checkpoint -d "wip"`. Use
  `--ready` / `--no-draft` to force a ready PR for one run.
- **By default** — `git config --global pr.draft true` (or `/pr setup
  draft`) opens every new PR as a draft. A per-invocation flag always
  overrides the default; `pr.draft` follows the same local-beats-global
  precedence as `pr.mode`.

Drafting applies at PR **creation**. An already-open PR is only flipped
when you pass an explicit flag that run (`gh pr ready` / `gh pr ready
--undo` under the hood) — the configured default never silently re-drafts
an open PR. `git stack submit` has no draft flag, so in the stacked
git-stack path the skill marks the just-created PRs draft right after
submitting.

## Subcommands

| Subcommand | What it does |
|---|---|
| `commit [message]` | Mode-aware alias for the default action — `update` in normal mode, `checkpoint` in stacked mode. Same as bare `/pr`. |
| `setup` | Show and change the persistent settings — the mode (`normal` ↔ `stacked`, `git config pr.mode`) and the draft default (`pr.draft`). Global by default. |
| `update [base-branch]` | Commit + push + update the current branch's PR (or open one). Doesn't change an existing PR's base. The normal-mode default. |
| `log` | Read-only. In normal mode show the current branch's PR; in stacked mode print the stack tree. |
| `merge [--merge\|--rebase\|--squash] [--all] [--dry-run]` | In normal mode merge the current branch's single PR. In stacked mode land the stack bottom-up with retarget verification. Refuses `--delete-branch` on stacks. |
| `checkpoint [slice description]` | Cut current diff as the next stacked branch. Local-only on the git-stack path (publishes nothing); the `gh`-fallback path still publishes eagerly. The stacked-mode default. |
| `submit` | Publish point: push the whole stack (force-with-lease), open/update one PR per branch, and stamp the `[<name> N/M]` title markers. Requires `git stack`. |
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

To open every new PR as a draft by default:

```sh
git config --global pr.draft true
```

Optional but recommended for stacked mode:

- `git stack` CLI — install separately from
  [`zcaceres/git-stack`](https://github.com/zcaceres/git-stack) releases.
  Without it, stacked mode falls back to `gh` + `git` (and `submit`,
  the whole-stack push, is unavailable).
