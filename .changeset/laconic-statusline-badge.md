---
"@zcaceres/skill-laconic": minor
---

Add a `statusline` subcommand that prints a compact `◆ laconic` badge when the
register is on (honouring project-over-user precedence) and nothing when it's
off, so it can be spliced into a `settings.json` `statusLine` command
unconditionally to show at a glance that the register is active. SKILL.md and
README document how to wire it in.
