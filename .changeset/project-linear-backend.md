---
"@zcaceres/skill-project": minor
---

Add a **linear** backend to the `project` skill, alongside github. The Linear
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
