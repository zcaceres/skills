---
"@zcaceres/skill-pr": patch
---

Correct the jj bookmark lifecycle in merge and sync: a rebase's `--skip-emptied` abandon does not delete the landed slice's bookmark (jj 0.43 parks it on the trunk tip, where it corrupts `bookmarks()`-based branch resolution) — merge's Strategy B now deletes it explicitly before pushing, sync documents the same cleanup, and both explain the `Refusing to create new remote bookmark` warning for never-pushed slices (expected: checkpoints stay local until submit).
