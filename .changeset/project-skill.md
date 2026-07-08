---
"@zcaceres/skill-project": minor
---

New skill `project` — a backend-neutral project-tracker kanban bundle that
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
