---
"@zcaceres/skill-pr": major
---

Remove the deprecated `commit-push-pr` and `pr-size-nudge` skills.

Both were folded into the consolidated `pr` skill:

- `commit-push-pr` → `/pr` in normal mode (commit conversation changes,
  push, open a single PR against the trunk).
- `pr-size-nudge` → the PostToolUse diff-size nudge hook bundled with
  `pr` (`pr-nudge`).

Migration: install `pr` (`npx skills add zcaceres/skills -s pr`) and run
its `scripts/install.sh` for the always-on nudge. If you previously
installed the standalone `pr-size-nudge` hook, remove its entry from
`settings.json` so you don't get duplicate nudges.
