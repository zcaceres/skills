# @zcaceres/skill-gh-project

## 0.1.0

### Minor Changes

- ae9c229: New skill `gh-project` — consolidates the seven `gh-project-*` skills
  (`setup`, `next`, `new-task`, `update`, `review`, `decompose`, `delete`)
  into a single skill with subcommands, mirroring the `pr` bundling.
  Invoke as `/gh-project <subcommand> [args]`; bare `/gh-project` prints the
  subcommand list. The per-subcommand workflows are ported verbatim into
  `references/`, and the shared `gh-project-board.sh` helper now ships with
  this skill. The seven standalone `gh-project-*` packages are removed.
- db28053: New skill `gh-project-decompose` — breaks a large card on the GitHub Projects
  kanban into smaller subtask cards through a collaborative proposal-and-refine
  loop. Drafts 3–7 subtasks from the parent body, lets the user reshape the
  batch (drop, merge, edit, regenerate, accept), then creates the children,
  links them via GitHub's sub-issues API plus a checklist appended to the
  parent body, and optionally moves the parent to In Progress.
- bc508c8: gh-project-next now ranks Todo cards by what's "logically next" by default,
  using whatever organizational signals the project actually uses (milestones
  with due dates, phase/priority labels, age) and showing a one-line "why"
  per candidate. Pass `--board-order` to restore the previous behavior of
  listing cards in raw kanban column order.
- 4a00996: gh-project-setup now offers to write a Claude Code permission allowlist for
  the safe `gh` command surface (read-only queries, card creation, status
  moves, and the board helper script) so sibling `/gh-project-*` skills run
  without per-call permission prompts. The user picks committed
  (`.claude/settings.json`) vs local (`.claude/settings.local.json`) and
  approves a diff before anything is written; declining still leaves setup
  successful.
