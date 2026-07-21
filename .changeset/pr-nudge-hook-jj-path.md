---
"@zcaceres/skill-pr": minor
---

pr: teach the diff-size nudge hook to measure jj repos. It now resolves the repo/VCS by probing `git rev-parse --show-toplevel` first (so a colocated repo stays on the git path, unchanged) and falling back to `jj root` for a native jj repo. On the jj path it measures the working-copy commit with `jj diff --git -r @` and counts `+`/`-` hunk lines via a new pure, unit-tested `parseJjDiffStat` — no untracked pass (jj has none). A native jj repo previously produced no nudge at all (git detection failed and the hook exited silently).
