---
"@zcaceres/skill-laconic": patch
---

Docs: bring the README in line with the shipped hooks. It only described the
`SessionStart` hook, omitting the `UserPromptSubmit` per-turn reminder and the
`/laconic cadence <N>` command that have shipped since 0.6.0. Also correct the
uninstall description in both README and SKILL.md: it unwires both hooks and
deletes `laconic.cadence` alongside `laconic.state`.
