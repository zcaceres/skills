---
"@zcaceres/skill-stacked-pr": major
---

Add `stacked-pr` — bundles the full stacked-PR workflow as one skill
with subcommands. This first cut ships:

- `/stacked-pr checkpoint [description]` — ports the current
  `/checkpoint` workflow. Cuts the uncommitted diff as the next branch
  in the stack, pushes it, opens a PR against the parent branch. Uses
  `git stack` when installed, else falls back to plain `gh` + `git`.
- `/stacked-pr update [base-branch]` — ports the current
  `/commit-push-pr` workflow. Commits + pushes + updates the current
  branch's PR (or opens one if missing) without changing an existing
  PR's base.

`/stacked-pr` with no subcommand defaults to `checkpoint`, so
`/stacked-pr "add CSV export"` runs checkpoint with that as the slice
description.

Subsequent PRs in the consolidation stack add `submit`, `log`, `sync`,
`merge`, and bundle the `pr-size-nudge` PostToolUse hook. The original
sibling skills (`checkpoint`, `commit-push-pr`, `pr-size-nudge`) remain
installable for one release cycle, then will be removed.
