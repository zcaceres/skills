---
"@zcaceres/skill-laconic": minor
---

Add a per-turn reminder to counter mid-session drift. A new `UserPromptSubmit`
hook restates the voice before each turn, so the rules stay near the top of the
context instead of decaying as the conversation grows.

Its cadence is configurable: `/laconic cadence <N>` fires the reminder every Nth
turn (1 = every turn, the default). The setting lives in its own `laconic.cadence`
file and resolves project-over-user, like the on/off state. `install.sh`,
`uninstall.sh`, and `status` all learn about the second hook and the cadence.

Also sharpen the voice rules the hooks inject: add a "right-size the reply" rule
that rejects answering a plain question with a survey of options in headers and
tables, since verbosity, not diction, is the main way the voice slips.
