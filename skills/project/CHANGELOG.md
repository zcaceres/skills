# @zcaceres/skill-project

## 0.1.0

### Minor Changes

- c348fad: Add a `batch` subcommand: apply one operation (create / update / delete) across many cards at once, with a single holistic preview, one confirmation, a continue-on-error apply loop, and a per-item tally. It's an envelope that reuses the per-card recipes from new-task / update / delete and preserves every single-card safety rule (typed `yes` on delete, no auto-resolving ambiguous selectors across a set, the "move finished cards to Done, don't delete" norm). Adds a `find-many` helper to the github board script for resolving many selectors in one board fetch. Backend-neutral: the linear backend resolves and applies through the Linear MCP.
- eb7147f: Add a **linear** backend to the `project` skill, alongside github. The Linear
  backend drives the official Linear MCP (no board script): `list_issues` /
  `get_issue` / `create_issue` / `update_issue` / `list_teams` /
  `list_issue_statuses` / `create_comment`.

  - `references/backends/linear.md` — the verb → MCP mapping, a Completeness rule
    that stands in for github's fail-loud `board.sh`, canonical → workflow-state
    translation, and the per-subcommand divergences.
  - `/project setup` asks GitHub vs Linear; the Linear flow picks a team and
    captures `list_issue_statuses` into the canonical `statusMap` (plus
    `statusNames`), writing a `backend: "linear"` config.
  - Native sub-issues via `create_issue(parentId)` (no REST/checklist), delete
    reframed as cancel/archive, and cycle/priority/estimate ranking for `next`.
  - The github adapter (`references/backends/github.md`) is unchanged.

- e7cfad1: Add a `milestone` subcommand — a canonical way to group work and execute toward
  it, over either backend. A "milestone" maps to a GitHub repo milestone on the
  github backend and to a Linear native project milestone on the linear backend.

  Actions: `create` a milestone, `add` a card to one, `next` (rank a milestone's
  open items and hand off the top one for execution, like `/project next` scoped to
  the milestone), and `list`. New adapter verbs `create_milestone` /
  `add_to_milestone` / `list_milestones` / `list_milestone_items` are documented per
  backend in `references/backends/{github,linear}.md`.

- e3e7d05: New skill `project` — a backend-neutral project-tracker kanban bundle that
  replaces `gh-project` (GitHub Projects becomes the `github` backend). This first
  cut ports the seven subcommands (`setup`, `next`, `new-task`, `update`, `review`,
  `decompose`, `delete`) verbatim behind a backend-adapter seam with a single
  `github` backend, so behavior is unchanged.

  - Config moves to `.project/config.json` (a legacy `.github/gh-project.json` is
    detected; `/project setup` migrates it). The helper ships as
    `.project/scripts/board.sh`.
  - Subcommand bodies speak a canonical status vocabulary
    (`backlog`/`todo`/`in_progress`/`done`/`cancelled`) resolved per backend via
    the config's `statusMap`.
  - A shared backend guard (`references/_guard.md`) and a per-backend adapter
    reference (`references/backends/github.md`) hold the seam a Linear backend
    will plug into next.

  The `gh-project` package is removed.
