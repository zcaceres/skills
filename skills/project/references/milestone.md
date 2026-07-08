# `/project milestone` — Group work and execute toward it

A **milestone** is a named, optionally-dated container of work items you create,
fill with cards, and work through. The term is canonical; each backend maps it to
its own native concept:

- **github** → a GitHub repo **milestone** (`gh api …/milestones`, `gh issue edit
  --milestone`).
- **linear** → a Linear **project** (`create_project`, `update_issue(projectId)`,
  `list_issues` by project). It is the standalone analogue of a github milestone:
  a name, a target date, a set of issues, and progress. (Linear also has finer
  "project milestones" *inside* a project; this skill uses the project itself.)

The per-backend command mapping for each verb below lives in
[backends/github.md](backends/github.md#milestone-verbs) and
[backends/linear.md](backends/linear.md#milestone-verbs).

## When to use

- "create a milestone" / "new milestone"
- "add #42 to the milestone" / "put this card in milestone X"
- "what's next in milestone X" / "milestone next"

## Prerequisites

**Run the [backend guard](_guard.md) first.** It resolves the backend and exports
its config (see the guard for the exported variables). Everything below calls the
milestone adapter verbs; the concrete commands are in the backend's adapter ref.

## Dispatch on the action

Parse the first whitespace-separated token after `milestone`:

| Action | Args | What it does |
|---|---|---|
| `create` | `<name> [--due YYYY-MM-DD] [--description …]` | Create a new milestone. |
| `add` | `<item-selector> <milestone-selector>` | Put one existing card into a milestone. |
| `next` | `<milestone-selector> [--auto]` | Rank the milestone's open items, pick one, move it to `in_progress`, dump context. |
| `list` | — | List milestones (also used to resolve a `<milestone-selector>`). |

Bare `/project milestone` with no action → print this table and stop. Unknown
action → don't guess; show the table.

`<milestone-selector>` resolves by name substring or id via `list_milestones`. If
it matches more than one, list the matches and ask.

## `create`

1. Gather the name (required), an optional due/target date, and an optional
   description from the args and conversation.
2. Call `create_milestone(name, due?, description?)`.
3. Report the created milestone (name, url/number or id, due date). End the turn.

> **github:** the milestone is created open on the repo.
> **linear:** a Linear project is created under the configured team; the due date
> is the project's target date.

## `add`

1. Resolve the card with `find_item(<item-selector>)` (PVTI_… / issue# / `SKL-…` /
   title substring). If ambiguous, list matches and ask.
2. Resolve the milestone with `find`/`list_milestones(<milestone-selector>)`.
3. Call `add_to_milestone(item_id, milestone)` and confirm what moved where.

> **github:** only issue-backed cards take a milestone — a board-only draft has no
> milestone field. If the card is a draft, say so and offer to convert it to an
> issue first (or skip).
> **linear:** every item is an issue; `add` sets its project.

## `next`

Same handoff contract as [`/project next`](next.md): rank, present, let the user
pick, move the pick to `in_progress`, dump full context, then stop — no branches,
no edits. The only difference is the **candidate set**: the milestone's open items,
not the board's Todo column.

1. Resolve the milestone (`list_milestones`).
2. `list_milestone_items(milestone, open)` → the not-`done` items in it. If empty:
   "Milestone `<name>` has no open items. It may be complete." Stop.
3. Rank and present exactly as [next.md Steps 2–3](next.md), using that backend's
   ranking signals (github: priority/phase labels then age; linear: cycle →
   priority → estimate → age). Board/creation order is the tiebreaker.
4. On the pick, confirm and `set_item_status(item_id, "in_progress")`, then dump
   context as [next.md Step 6](next.md).
5. `--auto`: skip the prompt, take rank #1, log the pick (as next.md `--auto`).

Read [next.md](next.md) for the ranking judgment and context-dump format — do not
re-derive them here.

## `list`

`list_milestones()` → each milestone's name, id/number, due/target date, and open
vs total item counts. Use it to show what exists and to resolve selectors for
`add`/`next`.

## Guidelines

- One milestone per `create`/`add` invocation. Re-invoke for the next.
- `next` stops at the context dump, like `/project next`. It does not start work.
- Don't invent a due date. If the user didn't give one, create the milestone
  without it.
