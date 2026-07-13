---
name: project
description: Manage the repo's project-tracker kanban board as one skill, over a pluggable backend (GitHub Projects or Linear). Subcommands bootstrap a board (setup), pick the next Todo card (next), create a card (new-task), edit a card (update), audit the board against the codebase (review), split a big card into subtasks (decompose), remove a card (delete), and group work into a milestone (milestone). Use when the user says "/project", "what's next", "new task", "add a card", "update card N", "review the board", "decompose this card", "delete card N", "create a milestone", "add this to the milestone", or "what's next in the milestone".
argument-hint: "[setup | next | new-task | update | review | decompose | delete | milestone] [args]"
---

# Project Tracker Kanban — One Skill

Run the full project-tracker board workflow as `/project <sub> [args]`.
Bundles board bootstrap, card creation, picking, editing, auditing,
decomposition, and deletion into a single skill with subcommands, so the
install is one unit instead of seven sibling skills.

The workflow bodies are **backend-neutral** — they call adapter verbs and speak
a canonical status vocabulary. Which tracker they drive is chosen at
`/project setup` and stored as `"backend"` in `.project/config.json`. Two
backends ship: **github** (GitHub Projects, `references/backends/github.md`) and
**linear** (the official Linear MCP, `references/backends/linear.md`). Every
subcommand except `setup` opens with the shared
[backend guard](references/_guard.md), which reads the config, picks the
backend, and asserts its prerequisites.

**Usage:** `/project [subcommand] [args]`

`$ARGUMENTS` is parsed by the dispatcher below. Read the matched subcommand's
reference file and follow it exactly.

## Subcommands

| Subcommand | Reference | What it does |
|---|---|---|
| `setup` | [references/setup.md](references/setup.md) | Bootstrap a GitHub Projects board for the repo: create + link the project, capture Status field IDs, write `.project/config.json`, install the board helper script, update agent docs. |
| `next [--board-order] [--auto]` | [references/next.md](references/next.md) | Rank Todo cards by what's logically next, let the user pick one, move it to In Progress, and dump the full card context. Stops at the handoff — no branches, no edits. |
| `new-task [title]` | [references/new-task.md](references/new-task.md) | Create a card (GitHub issue by default, draft on request) and END THE TURN — never start the work described in the card. |
| `update [id\|number\|title]` | [references/update.md](references/update.md) | Update one card's title, body, or status, folding in context from the conversation. Infers the target card if invoked bare, but never writes without confirmation. |
| `review` | [references/review.md](references/review.md) | Audit the board against the codebase: find cards that look Done or stale, present evidence, apply one-by-one approved status moves. |
| `decompose [id\|number\|title]` | [references/decompose.md](references/decompose.md) | Split a large card into 3–7 linked subtask cards through a propose-and-refine loop. Wires children via the sub-issues API plus a parent body checklist. |
| `delete [id\|number\|title]` | [references/delete.md](references/delete.md) | Remove a card from the board with mandatory show-and-confirm. Spells out draft deletion vs issue unlink before touching anything. |
| `milestone <create\|add\|next\|list>` | [references/milestone.md](references/milestone.md) | Group work into a milestone (a github milestone / a linear project milestone): create one, add a card to it, run a `next`-style pick scoped to the milestone, or list milestones. |

## Dispatcher

Parse the first whitespace-separated token of `$ARGUMENTS`:

1. **First token is a known subcommand keyword** (`setup`, `next`,
   `new-task`, `update`, `review`, `decompose`, `delete`, `milestone`) → read
   `references/<keyword>.md`, then follow its workflow with the remaining
   `$ARGUMENTS` (everything after the first token) as that subcommand's
   arguments. (`milestone` then dispatches again on its own action token —
   `create` / `add` / `next` / `list`.)

2. **First token starts with `-`** (e.g. `--help`, `-h`) → print the
   subcommand table above and stop.

3. **`$ARGUMENTS` is empty** → print the subcommand table above and stop.
   Unlike `/pr`, there is no default subcommand — the actions are
   too different to guess.

4. **First token is anything else** → do NOT guess. If the skill was
   triggered by a natural-language request (no explicit `/project`),
   map the user's intent to a subcommand using the trigger phrases in
   each reference's "When to use" section (e.g. "what's next" → `next`,
   "add a card" → `new-task`, "audit the kanban" → `review`). If the
   intent is ambiguous between two subcommands, show the table and ask.

## Important — applies to every subcommand

- Every subcommand except `setup` opens with the [backend guard](references/_guard.md).
  It requires `.project/config.json` (a legacy `.github/gh-project.json` is
  routed to `/project setup` for migration), determines the backend, and asserts
  that backend's prerequisites. If config is missing, stop and route the user to
  `/project setup` — never guess project IDs.
- On the **github** backend, board access goes through the
  `.project/scripts/board.sh` helper, not hand-rolled `gh project item-list` +
  `jq`. It asserts completeness against `totalCount` and fails loudly on
  truncation. The per-verb command mapping lives in
  [references/backends/github.md](references/backends/github.md).
- Subcommand bodies name **canonical** statuses (`backlog`, `todo`,
  `in_progress`, `done`, `cancelled`); the active backend adapter translates
  them to native values. Never hardcode a native status name in a body.
- One card per invocation for `new-task`, `update`, `decompose`, and
  `delete`. Re-invoke for the next card.
- When an item is finished, move it to `Done` — do not delete it.
