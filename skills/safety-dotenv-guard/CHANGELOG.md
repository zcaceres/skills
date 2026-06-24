# @zcaceres/skill-safety-dotenv-guard

## 2.0.0

### Major Changes

- 28c1880: Rename the four block-hook skills under a `safety-` prefix so they sort and
  read as a single category:

  - `rm-rf-guard` → `safety-rm-rf-guard`
  - `git-reset-guard` → `safety-git-reset-guard`
  - `dont-read-dot-env` → `safety-dotenv-guard`
  - `op-creds` → `safety-op-creds`

  Breaking changes for installers and anyone with hook wiring referencing the
  old paths: update `npx skills add -s <name>` invocations to the new name, and
  update `~/.claude/settings.json` hook command paths from
  `~/.claude/skills/<old>/scripts/run.sh` to `~/.claude/skills/<new>/scripts/run.sh`.
  The published binaries are also renamed (`<new>-darwin-arm64`, etc.).

### Minor Changes

- ccf2cde: Add `scripts/install.sh` to each hook skill — idempotently wires the
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

- 29f2b83: Make `scripts/install.sh` self-locating, and ship one for `pr`.

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

  **`pr` ships install.sh.** The bundled PostToolUse nudge
  hook now has the same one-liner install story as the other five
  hook skills, instead of requiring users to hand-edit
  `settings.json`. It also detects an older standalone `pr-size-nudge`
  entry and warns about the double-nudge before writing.

  `CLAUDE_HOME` is still used as the default `TARGET` for `--user`
  mode (where the settings file lives), which is correct independent
  of where the skill itself lives.

  Docs updated in each skill's `SKILL.md`, the `pr` `README.md`
  and `references/nudge.md`, and the root `README.md`.

## 1.0.0

### Major Changes

- Initial release: PreToolUse hook for Claude Code that blocks `Read`,
  `Bash`, `Grep`, and `Glob` tool calls targeting `.env` files so secrets
  never enter the agent's context. Allows template files (`.env.example`,
  `.env.sample`, `.env.template`, `.env.dist`) which are designed to be
  checked into source control. Ships pre-built standalone binaries for
  macOS arm64, Linux x64, and Windows x64.
