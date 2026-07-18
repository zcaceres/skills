# project

A single Claude Code skill that bundles a full project-tracker kanban workflow
over a **pluggable backend**. The workflow bodies are backend-neutral; which
tracker they drive is chosen at `/project setup` and recorded as `"backend"` in
`.project/config.json`. Two backends ship: **github** (GitHub Projects) and
**linear** (via the official Linear MCP).

Supersedes the standalone `gh-project` skill (GitHub becomes the `github`
backend). A repo configured under `gh-project` keeps working: `.github/gh-project.json`
is detected and `/project setup` migrates it to `.project/config.json`.

**Usage:** `/project <subcommand> [args]`

Bare `/project` prints the subcommand list — there is no default subcommand.

## Subcommands

| Subcommand | What it does |
|---|---|
| `setup` | Configure a backend and bootstrap its board: (github) create + link the project, capture Status field IDs, write `.project/config.json`, install the board helper, update agent docs. |
| `next [--board-order] [--auto]` | Rank Todo cards by what's logically next, let the user pick one, move it to In Progress, and dump the full card context. |
| `new-task [title]` | Create a card (an issue by default; github also supports a board-only draft). Ends the turn — never starts the work described in the card. |
| `update [id\|number\|title]` | Update one card's title, body, or status, folding in context from the conversation. |
| `review` | Audit the board against the codebase: find cards that look Done or stale, present evidence, apply one-by-one approved status moves. |
| `decompose [id\|number\|title]` | Split a large card into 3–7 linked subtask cards through a propose-and-refine loop. |
| `delete [id\|number\|title]` | Remove a card from the board with mandatory show-and-confirm. |
| `milestone <create\|add\|next\|list>` | Group work into a milestone (a github milestone / a linear project milestone): create one, add a card, run a `next`-style pick scoped to it, or list milestones. |
| `batch <create\|update\|delete>` | Apply one operation across many cards at once — bulk create, update, or delete — with a single preview and confirmation, a continue-on-error apply loop, and a per-item tally. An envelope over new-task / update / delete that preserves every per-card safety rule. |
| `walk [<milestone> \| --query \| --label \| --status] [--ranked] [--no-context]` | Walk a scoped set of cards one at a time: a concise block plus a decision menu (status / edit / comment / milestone / decompose / delete / dig / skip) applied per card as you go. Each card carries a light codebase-context signal (was it done elsewhere? did its premise drift?); `dig` escalates one card to deep reasoning, `--no-context` skips it. Interactive triage/grooming — an envelope over update / milestone / decompose / delete that keeps every per-card safety rule. |

See [SKILL.md](./SKILL.md) for the dispatcher and the per-subcommand references
for the full workflows.

## How it works

Every subcommand except `setup` opens with the shared
[backend guard](references/_guard.md): it reads `.project/config.json`,
determines the backend, asserts that backend's prerequisites, and exports the
config the body uses. Bodies call **adapter verbs** and name **canonical**
statuses (`backlog`/`todo`/`in_progress`/`done`/`cancelled`); the active backend
translates them. Per-backend command mappings live under
[references/backends/](references/backends/).

On the **github** backend, `/project setup` writes two files into the repo:

- `.project/config.json` — `backend`, project number/owner/node ID, the Status
  field id + option-id map, and a `statusMap` (canonical → native option name).
- `.project/scripts/board.sh` — a small bash helper (`list` / `find` / `get` /
  `set-status`) all subcommands use for board access. It asserts completeness
  against `totalCount` and exits non-zero on truncation, so an agent that
  "doesn't see" a card fails loudly instead of silently missing it.

The canonical helper script ships with this skill at
[scripts/board.sh](scripts/board.sh); the github verb mapping is
[references/backends/github.md](references/backends/github.md).

## Install

```sh
npx skills add zcaceres/skills -s project
```

Then run `/project setup` once per repo to pick a backend, create/link the
board, write the config, and (github) install the helper script.

Requirements are backend-specific. The **github** backend needs the `gh` CLI
authenticated with the `project` scope (`gh auth refresh -s project`) and `jq`.
The **linear** backend needs the official Linear MCP connected; there is no
script or `gh` dependency.
