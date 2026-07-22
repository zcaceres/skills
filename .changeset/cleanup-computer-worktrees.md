---
"@zcaceres/skill-cleanup-computer": minor
---

Add a git worktree cleanup phase. Sweeps repos under common dev roots, classifies
each linked worktree, and proposes removal only for safe candidates — clean
working tree and branch fully merged into trunk. Never uses `git worktree remove
--force`; keeps dirty, unmerged, or locked worktrees and flags them.
