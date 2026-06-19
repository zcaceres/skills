---
"@zcaceres/skill-pr": minor
---

Add a `commit` alias for the everyday action. `/pr commit [message]` runs
the active mode's default — `update` in normal mode, `checkpoint` in
stacked mode — identical to bare `/pr`. It is deliberately mode-aware
rather than a hard alias to `checkpoint`, so typing `/pr commit` in normal
mode never forces stacked behavior. When `commit` is the first token, the
remaining arguments seed the commit message / slice description.
