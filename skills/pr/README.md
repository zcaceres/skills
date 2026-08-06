# pr

A single agent skill for committing your work and shipping it as stacked PRs with `/pr`. Each `/pr` cuts the current diff onto a new local branch in a GitHub-managed stack; publish the finished stack all at once with `submit` — no trickle of partial PRs on GitHub. GitHub's native stack UI shows the layers, ordering, and navigation, so the skill does not rewrite PR titles with custom markers.

The Git backend uses GitHub's first-party [`gh-stack`](https://github.com/github/gh-stack) extension. Install it once:

```sh
gh extension install github/gh-stack
```

`/pr update` covers the single-branch case — commit and refresh the current branch's PR without cutting a new stacked branch.

**Usage:** `/pr [subcommand] [args]` in Claude Code and Gemini CLI;
`$pr [subcommand] [args]` in Codex.

## Default action

`/pr` with no subcommand — or `/pr commit [message]` — checkpoints: it
cuts the current diff as the next stacked branch, with the message as
the slice description.

## Slice by concern

Before committing or publishing, `/pr` reviews the whole diff for independent
concerns. PR boundaries follow reviewer-meaningful operations rather than a
fixed line limit: mechanical renames/refactors, documentation, and behavior or
business-logic changes normally become separate stacked PRs, while directly
coupled tests stay with the behavior they verify.

For example, a 400-line body of work containing docs, a rename, and a business
logic change should normally become three ordered PRs. `/pr` proposes the stack
and confirms it with you before checkpointing each concern. A large coherent
change can remain one PR; tiny unrelated changes should still be split. This
guidance is part of the normal workflow and does not require the optional
size-nudge hook.

Stack order should orient the reviewer early. When useful, lead with a tracer
bullet, foundational interfaces or types, or an overview README/design document
that makes the direction of later slices clear, then order the rest by
dependency and reviewability. PR notes stay concise and local to each slice;
the bottom PR includes a slightly fuller overview of the stack and previews
what follows.

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
an open PR. For a stack, `/pr submit` uses `gh stack submit --auto` for drafts and
`gh stack submit --auto --open` for ready PRs.

## Subcommands

| Subcommand | What it does |
|---|---|
| `commit [message]` | Alias for the default action — `checkpoint`, with the message as the slice description. Same as bare `/pr`. |
| `setup` | Show and change the persistent settings — the draft default (`pr.draft`) and the backend (`pr.backend`, `git` ↔ `jj`). Global by default. Enable the optional nudge only with `/pr setup nudge`. |
| `update [base-branch]` | Commit + push + update the current branch's PR (or open one). The single-branch flow; doesn't change an existing PR's base. |
| `log` | Read-only. Print the stack tree with each branch's PR status. |
| `walk [PR-number-or-URL]` | Generate a numbered Markdown review document with one notes area and an exact `.patch` for each open PR, render each complete PR in chat with colorized git-delta diffs and structured controls, then apply the approved stack-wide plan and restack/push safely. |
| `merge [--merge\|--rebase\|--squash] [--all] [--dry-run]` | Land the stack through GitHub's native asynchronous all-or-nothing stack-merge API. |
| `checkpoint [slice description]` | Cut current diff as the next local stacked branch. It publishes nothing. The default action. |
| `submit [--draft]` | Publish point: push the whole stack and open/update one PR per branch, linked in GitHub's native stack UI. Requires `gh stack`. |
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

This installs only the `/pr` skill; the nudge remains disabled. Use
`-a codex` to target Codex explicitly.

To opt into the nudge, run `/pr setup nudge`, or invoke the installer
directly:

```sh
~/.claude/skills/pr/scripts/install.sh
# Codex:
~/.codex/skills/pr/scripts/install.sh --agent codex
```

The installer wires the bundled nudge hook into the selected host's config
so it fires on every matching tool call,
not just when the skill is active in context. The script is
idempotent, backs up the target file with a timestamp, and is a
no-op if the hook is already wired. The script self-locates, so it
works whether the skill was installed at user scope or project
scope. Use `--agent claude|codex|gemini`; Codex writes
`~/.codex/hooks.json` and requires reviewing the new hook with `/hooks`.
Flags: `--project`, `--target PATH`. Requires `jq`. Skip this opt-in
step if you only want the skill command.

To open every new PR as a draft by default:

```sh
git config --global pr.draft true
```

Required for the git backend:

- GitHub's first-party stack extension:
  ```sh
  gh extension install github/gh-stack
  ```
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
