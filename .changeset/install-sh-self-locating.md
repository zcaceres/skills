---
"@zcaceres/skill-safety-rm-rf-guard": minor
"@zcaceres/skill-safety-git-reset-guard": minor
"@zcaceres/skill-safety-dotenv-guard": minor
"@zcaceres/skill-safety-op-creds": minor
"@zcaceres/skill-pr-size-nudge": minor
"@zcaceres/skill-stacked-pr": minor
---

Make `scripts/install.sh` self-locating, and ship one for `stacked-pr`.

**Self-locating path.** Previously each install.sh wrote
`$CLAUDE_HOME/skills/<skill>/scripts/run.sh` as the hook command —
a path that only resolves correctly when the skill is installed at
user scope. A user who ran `npx skills add ... --project` (project-
scope skill install) followed by `install.sh --project` ended up with
a hook pointing at `~/.claude/skills/<skill>/scripts/run.sh`, which
doesn't exist. The hook silently never fired.

The fix derives the runner path from the script's own location
(`SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"`), so the same command
works whether the skill was installed at user scope, project scope,
or under a custom `CLAUDE_CONFIG_DIR`. Also adds a fast-fail check
that errors with a clear message if the runner isn't found beside
the install.sh (catches the case where someone copied install.sh
out of its directory).

**`stacked-pr` ships install.sh.** The bundled PostToolUse nudge
hook now has the same one-liner install story as the other five
hook skills, instead of requiring users to hand-edit
`settings.json`. It also detects an older standalone `pr-size-nudge`
entry and warns about the double-nudge before writing.

`CLAUDE_HOME` is still used as the default `TARGET` for `--user`
mode (where the settings file lives), which is correct independent
of where the skill itself lives.

Docs updated in each skill's `SKILL.md`, the `stacked-pr` `README.md`
and `references/nudge.md`, and the root `README.md`.
