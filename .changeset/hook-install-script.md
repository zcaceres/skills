---
"@zcaceres/skill-safety-rm-rf-guard": minor
"@zcaceres/skill-safety-git-reset-guard": minor
"@zcaceres/skill-safety-dotenv-guard": minor
"@zcaceres/skill-safety-op-creds": minor
"@zcaceres/skill-pr-size-nudge": minor
---

Add `scripts/install.sh` to each hook skill — idempotently wires the
hook into `~/.claude/settings.json` (with a timestamped backup) so the
hook fires on every matching tool call, not just while the skill is
active in context. Supports `--user` (default), `--project`, and
`--target PATH` scopes. Requires `jq`. Each script is a no-op if the
hook is already wired.

Sharpens the frontmatter `description` on each skill to make the
limitation of `hooks:` blocks explicit: they fire only while the skill
is loaded into the conversation context, not always-on, and the new
`install.sh` is what closes that gap. Updates each skill's `SKILL.md`
Install section to lead with the two-step install, and demotes the
manual JSON snippet to an alternative.

Updates the root README's hook-skills note to reflect the new
convention.

**Why.** Ground-truth research on the `skills` CLI (`vercel-labs/skills`
@ 1.5.10) confirmed it runs zero publisher code on install — no
lifecycle hooks of any kind. And Claude Code's frontmatter `hooks:`
blocks are officially scoped to "while the skill is active," meaning a
fresh install with no explicit invocation leaves the guard dormant.
Always-on protection requires explicit settings.json wiring, and
`install.sh` is the smallest publisher-shippable surface that can do
that wiring without auto-editing user config at unpack time.
