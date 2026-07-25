---
"@zcaceres/skill-pr": patch
---

Fix two reproduced bugs in the gh-fallback stacked docs: checkpoint's 6B path now records `branch.<name>.stack-parent` / `gh-merge-base` (without it, log/sync/merge/renumber all saw a one-branch stack), and merge/log stop seeding rebase boundaries and fork points from `origin/$B~1` — which is mid-slice for any multi-commit branch — in favor of recorded pre-rebase parent tips and `git merge-base`.
