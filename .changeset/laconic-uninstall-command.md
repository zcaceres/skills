---
"@zcaceres/skill-laconic": minor
---

Add an uninstall command. `/laconic uninstall [--project|--user]` (and
`scripts/uninstall.sh`) reverses the install for a scope: it unwires the
`SessionStart` hook from `settings.json` (backing the file up first), prunes any
now-empty hook blocks while leaving unrelated hooks intact, and deletes that
scope's `laconic.state`. Idempotent, and it warns instead of silently breaking a
`statusLine` command that still references laconic. Pass `--keep-state` to unwire
the hook without deleting state.
