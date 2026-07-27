---
"@zcaceres/skill-pr": patch
---

Harden the jj backend references against 11 failure modes surfaced by live
stacked-PR exercising: guard the merge retarget block against unpublished
slices, document the phantom conflict after squash-merging a multi-commit
slice (and its `jj abandon` remedy), scope the submit bookmark-less-slice
guard to commits above the topmost bookmark, document silent fast-forward
drift and its detection revset, note lingering divergent change ids, require
bash for the renumber routine (zsh corrupts markers), warn that jj's own
hint advertises the banned `jj git push --deleted` (use `jj bookmark forget`),
guard `$BRANCH` resolution against multi-bookmark commits, re-anchor `@` on
the stack top after conflict resolution, note the benign detached-HEAD
warning from `gh pr merge`, and mark the checkpoint carve-verify as mandatory
(a typo'd path commits an empty slice with exit 0).
