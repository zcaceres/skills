---
"@zcaceres/skill-pr": major
---

Remove the `checkpoint` skill.

`/checkpoint` has been folded into `/pr checkpoint`. The
standalone `checkpoint` skill (package `@zcaceres/skill-checkpoint`) is
deleted from this monorepo and will no longer be published. The
deprecation banner was added in the same release that introduced
`pr`, but `@zcaceres/skill-checkpoint` was never actually
published to npm, so removing it now does not break a shipped
deprecation contract for any user.

Migration: replace `/checkpoint [...]` invocations with `/pr
checkpoint [...]`. The argument shape and behavior are identical —
only the slash-command surface has changed. Install `pr` via
`npx skills add zcaceres/skills -s pr` to pick up both the
subcommand and the bundled PostToolUse nudge.
