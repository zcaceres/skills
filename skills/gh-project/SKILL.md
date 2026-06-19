---
name: gh-project
description: Manage the repo's GitHub Projects kanban board as one skill. Subcommands bootstrap a board (setup), pick the next Todo card (next), create a card (new-task), edit a card (update), audit the board against the codebase (review), split a big card into subtasks (decompose), remove a card (delete), and create/update/delete many cards at once (batch). Use when the user says "/gh-project", "what's next", "new task", "add a card", "update card N", "review the board", "decompose this card", "delete card N", "create/update/delete these cards", or "batch".
argument-hint: "[setup | next | new-task | update | review | decompose | delete | batch] [args]"
---

# GitHub Projects Kanban — One Skill

Run the full GitHub Projects board workflow as `/gh-project <sub> [args]`.
Bundles board bootstrap, card creation, picking, editing, auditing,
decomposition, and deletion into a single skill with subcommands, so the
install is one unit instead of seven sibling skills.

**Usage:** `/gh-project [subcommand] [args]`

`$ARGUMENTS` is parsed by the dispatcher below. Read the matched subcommand's
reference file and follow it exactly.

## Subcommands

| Subcommand | Reference | What it does |
|---|---|---|
| `setup` | [references/setup.md](references/setup.md) | Bootstrap a GitHub Projects board for the repo: create + link the project, capture Status field IDs, write `.github/gh-project.json`, install the board helper script, update agent docs. |
| `next [--board-order] [--auto]` | [references/next.md](references/next.md) | Rank Todo cards by what's logically next, let the user pick one, move it to In Progress, and dump the full card context. Stops at the handoff — no branches, no edits. |
| `new-task [title]` | [references/new-task.md](references/new-task.md) | Create a card (GitHub issue by default, draft on request) and END THE TURN — never start the work described in the card. |
| `update [id\|number\|title]` | [references/update.md](references/update.md) | Update one card's title, body, or status, folding in context from the conversation. Infers the target card if invoked bare, but never writes without confirmation. |
| `review` | [references/review.md](references/review.md) | Audit the board against the codebase: find cards that look Done or stale, present evidence, apply one-by-one approved status moves. |
| `decompose [id\|number\|title]` | [references/decompose.md](references/decompose.md) | Split a large card into 3–7 linked subtask cards through a propose-and-refine loop. Wires children via the sub-issues API plus a parent body checklist. |
| `delete [id\|number\|title]` | [references/delete.md](references/delete.md) | Remove a card from the board with mandatory show-and-confirm. Spells out draft deletion vs issue unlink before touching anything. |
| `batch <create\|update\|delete> [list\|file\|--query]` | [references/batch.md](references/batch.md) | Apply one operation across many cards: create a list of cards, update a set, or delete a set. Ingests an inline list / file / board query, previews the whole set once, confirms once, applies in a continue-on-error loop, and reports a tally. Reuses the single-card recipes from new-task / update / delete. |

## Dispatcher

Parse the first whitespace-separated token of `$ARGUMENTS`:

1. **First token is a known subcommand keyword** (`setup`, `next`,
   `new-task`, `update`, `review`, `decompose`, `delete`, `batch`) → read
   `references/<keyword>.md`, then follow its workflow with the remaining
   `$ARGUMENTS` (everything after the first token) as that subcommand's
   arguments. (`batch` then parses its own next token — `create` / `update` /
   `delete` — as the batch mode.)

2. **First token starts with `-`** (e.g. `--help`, `-h`) → print the
   subcommand table above and stop.

3. **`$ARGUMENTS` is empty** → print the subcommand table above and stop.
   Unlike `/pr`, there is no default subcommand — the actions are
   too different to guess.

4. **First token is anything else** → do NOT guess. If the skill was
   triggered by a natural-language request (no explicit `/gh-project`),
   map the user's intent to a subcommand using the trigger phrases in
   each reference's "When to use" section (e.g. "what's next" → `next`,
   "add a card" → `new-task`, "audit the kanban" → `review`). When the
   request is clearly **plural** — a list of cards to create, a set to
   update, or several to delete ("add all of these", "delete these three",
   "move every X card to Done") → `batch` (then its mode). If the intent is
   ambiguous between two subcommands, show the table and ask.

## Important — applies to every subcommand

- Every subcommand except `setup` requires `.github/gh-project.json` and
  the `.github/scripts/gh-project-board.sh` helper. If either is missing,
  stop and route the user to `/gh-project setup` — never guess project
  IDs.
- Board access goes through the helper script, not hand-rolled
  `gh project item-list` + `jq`. It asserts completeness against
  `totalCount` and fails loudly on truncation.
- One card per invocation for `new-task`, `update`, `decompose`, and
  `delete`. Re-invoke for the next card — **unless** the user wants the same
  operation across many cards, which is exactly what `batch` is for. `batch`
  previews the whole set and takes a single confirmation; it does not loosen
  any single-card safety rule (delete still requires a typed `yes`).
- When an item is finished, move it to `Done` — do not delete it (this applies
  to `batch delete` too — push back before bulk-deleting finished cards).
