# gh-project

A single Claude Code skill that bundles the full GitHub Projects kanban
workflow. Supersedes the seven sibling skills (`gh-project-setup`,
`gh-project-next`, `gh-project-new-task`, `gh-project-update`,
`gh-project-review`, `gh-project-decompose`, `gh-project-delete`) that
previously had to be installed separately.

**Usage:** `/gh-project <subcommand> [args]`

Bare `/gh-project` prints the subcommand list — there is no default
subcommand.

## Subcommands

| Subcommand | What it does |
|---|---|
| `setup` | Bootstrap a GitHub Projects board for the repo: create + link the project, capture Status field IDs, write `.github/gh-project.json`, install the board helper script, update agent docs. |
| `next [--board-order] [--auto]` | Rank Todo cards by what's logically next, let the user pick one, move it to In Progress, and dump the full card context. |
| `new-task [title]` | Create a card (GitHub issue by default, draft on request). Ends the turn — never starts the work described in the card. |
| `update [id\|number\|title]` | Update one card's title, body, or status, folding in context from the conversation. |
| `review` | Audit the board against the codebase: find cards that look Done or stale, present evidence, apply one-by-one approved status moves. |
| `decompose [id\|number\|title]` | Split a large card into 3–7 linked subtask cards through a propose-and-refine loop. |
| `delete [id\|number\|title]` | Remove a card from the board with mandatory show-and-confirm. |
| `batch <create\|update\|delete> [list\|file\|--query]` | Apply one operation across many cards at once — create a list, update a set, or delete a set. Ingests an inline list / file / board query, previews the whole set once, confirms once, applies in a continue-on-error loop, and reports a tally. Reuses the single-card `new-task` / `update` / `delete` recipes. |

See [SKILL.md](./SKILL.md) for the dispatcher and the per-subcommand
references for the full workflows.

## How it works

`/gh-project setup` writes two files into the target repo:

- `.github/gh-project.json` — project number, owner, node ID, status
  field ID, and status option IDs. Every other subcommand reads this
  instead of hard-coding IDs.
- `.github/scripts/gh-project-board.sh` — a small bash helper
  (`list` / `find` / `find-many` / `get` / `set-status`) that all
  subcommands use for board access. It asserts completeness against
  `totalCount` and exits non-zero on truncation, so an agent that
  "doesn't see" a card fails loudly instead of silently missing it.
  `find-many` resolves many selectors against a single board fetch, which
  is what `batch update` / `batch delete` use to target a set of cards.

The canonical helper script ships with this skill at
[scripts/gh-project-board.sh](scripts/gh-project-board.sh).

## Install

```sh
npx skills add zcaceres/skills -s gh-project
```

Then run `/gh-project setup` once per repo to create the board, write
the config, and install the helper script.

Requires the `gh` CLI authenticated with the `project` scope
(`gh auth refresh -s project`) and `jq`.

## Origin

Consolidates these previously-separate skills into one distributable unit:

- `gh-project-setup` (removed) → `/gh-project setup`
- `gh-project-next` (removed) → `/gh-project next`
- `gh-project-new-task` (removed) → `/gh-project new-task`
- `gh-project-update` (removed) → `/gh-project update`
- `gh-project-review` (removed) → `/gh-project review`
- `gh-project-decompose` (removed) → `/gh-project decompose`
- `gh-project-delete` (removed) → `/gh-project delete`
