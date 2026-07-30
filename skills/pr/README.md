# pr

A single Claude Code skill for committing your work and shipping it as
stacked PRs with `/pr`. Each `/pr` cuts the current diff onto a new
branch stacked on the last (built **locally**, with `git stack`), then
you publish the finished stack all at once with `submit` — no trickle of
partial PRs on GitHub. Plus subcommands to review the whole stack as
annotatable Markdown, rebase onto trunk, and merge bottom-up. Published
PRs get a `[<name> N/M]` title marker (e.g.
`[ENG-456 2/4] …`, named after the ticket when the branch carries one,
else a slug) so GitHub shows at a glance which stack a PR is in and
where it sits — see
[references/title-convention.md](references/title-convention.md).

`/pr update` covers the single-branch case — commit and refresh the
current branch's PR without cutting a new stacked branch.

It detects whether the
[`git-stack`](https://github.com/zcaceres/git-stack) CLI is installed —
if yes, uses its primitives; otherwise falls back to plain `gh` + `git`.

**Usage:** `/pr [subcommand] [args]`

## Default action

`/pr` with no subcommand — or `/pr commit [message]` — checkpoints: it
cuts the current diff as the next stacked branch, with the message as
the slice description.

## Drafts

Any PR `/pr` **creates** can be a draft:

- **Per invocation** — add `--draft` (or `-d`) to any `/pr` command:
  `/pr --draft`, `/pr update --draft`, `/pr checkpoint -d "wip"`. Use
  `--ready` / `--no-draft` to force a ready PR for one run.
- **By default** — `git config --global pr.draft true` (or `/pr setup
  draft`) opens every new PR as a draft. A per-invocation flag always
  overrides the default; a local `pr.draft` value beats a global one.

Drafting applies at PR **creation**. An already-open PR is only flipped
when you pass an explicit flag that run (`gh pr ready` / `gh pr ready
--undo` under the hood) — the configured default never silently re-drafts
an open PR. In the stacked git-stack path, `git stack submit --draft`
opens the just-created PRs as drafts natively (driven by the same draft
intent — an explicit flag or the `pr.draft` default).

## Subcommands

| Subcommand | What it does |
|---|---|
| `commit [message]` | Alias for the default action — `checkpoint`, with the message as the slice description. Same as bare `/pr`. |
| `setup` | Show and change the persistent settings — the draft default (`pr.draft`) and the backend (`pr.backend`, `git` ↔ `jj`). Global by default. Enable the optional nudge only with `/pr setup nudge`. |
| `update [base-branch]` | Commit + push + update the current branch's PR (or open one). The single-branch flow; doesn't change an existing PR's base. |
| `log` | Read-only. Print the stack tree with each branch's PR status. |
| `walk [PR-number-or-URL]` | Generate a numbered Markdown review document with one notes area and an exact `.patch` for each open PR, render each complete PR in chat with colorized git-delta diffs and structured controls, then apply the approved stack-wide plan and restack/push safely. |
| `merge [--merge\|--rebase\|--squash] [--all] [--dry-run]` | Land the stack bottom-up with retarget verification. Refuses `--delete-branch` on stacks. |
| `checkpoint [slice description]` | Cut current diff as the next stacked branch. Local-only on the git-stack path (publishes nothing); the `gh`-fallback path still publishes eagerly. The default action. |
| `submit [--draft]` | Publish point: push the whole stack (force-with-lease), open/update one PR per branch, and stamp the `[<name> N/M]` title markers. `--draft` opens the created PRs as drafts. Requires `git stack`. |
| `sync [--no-push]` | Fetch trunk and rebase every branch in the stack onto the updated tip. Force-push-with-lease unless `--no-push`. |

See [references/recovery.md](references/recovery.md) if a `--delete-branch`
mishap has already auto-closed a child PR.

## Optional PostToolUse hook

This skill also ships a diff-size nudge hook. It fires after every
`Edit`/`Write`/`MultiEdit`/`NotebookEdit` tool call and emits a soft
reminder to run `/pr` when the uncommitted diff crosses size/file
thresholds — so you land a focused PR (a stacked checkpoint) before the
diff grows unwieldy.

The hook is opt-in: installing the skill and using `/pr setup` for draft
or backend settings do not activate or provision it. Enable it with
`/pr setup nudge` or the bundled `scripts/install.sh` (see Install
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
```

This installs only the `/pr` skill; the nudge remains disabled.

To opt into the nudge, run `/pr setup nudge`, or invoke the installer
directly:

```sh
~/.claude/skills/pr/scripts/install.sh
```

The installer wires the bundled PostToolUse nudge hook into
`~/.claude/settings.json` so it fires on every matching tool call,
not just when the skill is active in context. The script is
idempotent, backs up the target file with a timestamp, and is a
no-op if the hook is already wired. The script self-locates, so it
works whether the skill was installed at user scope or project
scope. Flags: `--project`, `--target PATH`. Requires `jq`. Skip
this opt-in step if you only want the slash command.

To open every new PR as a draft by default:

```sh
git config --global pr.draft true
```

Optional but recommended:

- `git stack` CLI — install separately from
  [`zcaceres/git-stack`](https://github.com/zcaceres/git-stack) releases.
  Without it, the skill falls back to `gh` + `git` (and `submit`,
  the whole-stack push, is unavailable).
- [`git-delta`](https://github.com/dandavison/delta) — provides colorized,
  syntax-highlighted, line-numbered diffs during conversational `/pr walk`.
  If another `delta` CLI shadows it, set `PR_WALK_DELTA` to the git-delta
  executable path.

## Live test bed (maintainers)

[`zcaceres/jj-pr-skill-test`](https://github.com/zcaceres/jj-pr-skill-test)
is a private throwaway repo for exercising this skill's workflows against
real GitHub behavior — stacked submit/retarget/merge, teammate drift
(fast-forward and divergent pushes from a second clone), trunk movement,
mid-stack edits, and both backends (clone it and `jj git init --colocate`
+ `git config pr.backend jj` for jj). Its history and PRs are disposable:
reset `main`, force-push, close PRs, and delete branches freely — nothing
in it is real work. The jj-backend guidance in `references/jj.md` reflects
findings from three rounds of exercising in this repo; reuse the test bed for
future skill changes rather than minting a new repo.
