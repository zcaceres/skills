---
"@zcaceres/skill-pr": major
---

Make stacked PRs the only mode and mirror the backends in the file tree. The `pr.mode` setting and "normal mode" are gone: bare `/pr` (and `/pr commit`) always checkpoints the current diff as the next stacked branch, and `/pr setup` now manages only the draft default and the backend. The single-PR flow survives as the explicit `/pr update` subcommand, and `log`/`merge` treat an unstacked branch as a one-branch stack. The git workflow docs moved from `references/` into `references/git/`, mirroring `references/jj/`, so each backend has its own directory (`setup.md`, `nudge.md`, `recovery.md`, and `title-convention.md` stay shared at the top level).

Breaking: an existing `git config pr.mode normal` is ignored — bare `/pr` now checkpoints instead of updating a single PR. Use `/pr update` for that flow.
