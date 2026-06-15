---
"@zcaceres/skill-pr": minor
---

Bundle the `pr-size-nudge` PostToolUse hook into `pr`.

Hook source (`scripts/index.ts`), prebuilt binaries
(`scripts/bin/pr-nudge-{linux-x64,darwin-arm64,windows-x64.exe}`),
launcher scripts (`scripts/run.sh`, `scripts/run.cmd`), and tests
now ship with `pr`. The nudge text points at
`/pr checkpoint`.

Env vars and state file are namespaced to `pr-nudge` so the
bundled hook coexists with an older standalone `pr-size-nudge`
install during the deprecation window — but if both are wired in
`settings.json`, you'll get double nudges. Remove the old entry
before adding this one. Legacy `PR_NUDGE_*` env vars are still
honored as fallbacks.

The `hooks:` frontmatter block is included for forward compatibility,
but Claude Code does not yet substitute `${CLAUDE_SKILL_DIR}` in
frontmatter hook commands — manual wiring via `settings.json` is
still required. See [`references/nudge.md`](../skills/pr/references/nudge.md).

Also adds deprecation banners to the two remaining original sibling
skills (`commit-push-pr`, `pr-size-nudge`). They remain installable
for one release cycle. The third original (`checkpoint`) is removed
in the same release — see the `pr-remove-checkpoint`
changeset.
