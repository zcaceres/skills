---
"@zcaceres/skill-pr": patch
---

Guard the git-backend merge retarget blocks against unpublished slices:
with no open PR for the next slice, `gh pr view ""` / `gh pr edit ""`
silently resolve to the current branch's PR, falsely verifying — or
retargeting — the wrong PR. Mirrors the jj-backend fix.
