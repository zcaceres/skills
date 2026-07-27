---
"@zcaceres/skill-pr": patch
---

Harden the jj docs: checkpoint verifies the carve (`jj diff -r @-/-r @ --summary`, `jj undo` recovery) before bookmarking, and submit gains a bookmark-completeness guard — bookmark-less committed slices get a named bookmark (or a confirmed `jj squash`) instead of silently folding into the next PR's diff.
