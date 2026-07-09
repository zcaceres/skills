---
"@zcaceres/skill-laconic": minor
---

Status-line badge now names the code mode: `laconic.sh statusline` prints
`◆ laconic-code` when the resolved mode is `laconic-code`, and `◆ laconic`
for the prose modes. Off/unset still prints nothing, so the injected line
makes it clear at a glance when you're in code-first mode.
