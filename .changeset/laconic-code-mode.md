---
"@zcaceres/skill-laconic": minor
---

Add a third mode, `laconic-code`. In this mode the voice replies primarily *in*
code: a snippet is the message, and prose only frames it, kept modest. Use it to
show a bug, a design, an architecture, or finished work as a diff, before/after,
signature, or file tree. It keeps prose+code's artifact rules and never
compresses the code, and it still uses words when they're genuinely clearer (a
risk, a tradeoff, a why).

Enable it with `/laconic on laconic-code` or `/laconic mode laconic-code`. The
`SessionStart` hook's mode filter now also accepts a comma-separated mode list on
a `<!-- mode:a,b -->` region marker, so the prose examples stay scoped to the
prose modes while the code-first examples show only in `laconic-code`.
