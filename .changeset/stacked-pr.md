---
"@zcaceres/skill-pr": major
---

Add `pr` — bundles the full stacked-PR workflow as one skill
with subcommands. This first cut ships:

- `/pr checkpoint [description]` — ports the workflow from the
  former `checkpoint` skill (removed in the same release; see the
  `pr-remove-checkpoint` changeset). Cuts the uncommitted diff
  as the next branch in the stack, pushes it, opens a PR against the
  parent branch. Uses `git stack` when installed, else falls back to
  plain `gh` + `git`.
- `/pr update [base-branch]` — ports the current
  `/commit-push-pr` workflow. Commits + pushes + updates the current
  branch's PR (or opens one if missing) without changing an existing
  PR's base.

`/pr` with no subcommand defaults to `checkpoint`, so
`/pr "add CSV export"` runs checkpoint with that as the slice
description.

Subsequent PRs in the consolidation stack add `submit`, `log`, `sync`,
`merge`, and bundle the `pr-size-nudge` PostToolUse hook. The
`checkpoint` skill is removed in the same release (see the
`pr-remove-checkpoint` changeset). The other sibling skills
(`commit-push-pr`, `pr-size-nudge`) remain installable for one release
cycle, then will be removed.
