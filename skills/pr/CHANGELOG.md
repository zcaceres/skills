# @zcaceres/skill-pr

## 1.0.0

### Major Changes

- 12750bc: Rename the `stacked-pr` skill to `pr` and add a default non-stacked mode.

  The command is now `/pr`. The skill has two modes, stored in
  `git config pr.mode`:

  - **normal** (default) — `/pr` commits your conversation changes, pushes,
    and opens a single PR against the trunk (the former `commit-push-pr`
    flow).
  - **stacked** — `/pr` becomes the stacked-PR workflow: `/pr` checkpoints
    the current diff onto a new branch, plus `submit`, `sync`, and
    bottom-up `merge`.

  New `/pr setup` subcommand toggles the mode (writes `git config pr.mode`,
  global by default). `update`, `log`, and `merge` work in both modes;
  `log` and `merge` take a mode-specific path. `checkpoint`, `submit`, and
  `sync` are the stacked operations and run regardless of mode when named
  explicitly.

  The bundled PostToolUse nudge now points at `/pr` and its binary/state
  are renamed to `pr-nudge`. `PR_NUDGE_*` env vars are primary;
  `STACKED_PR_NUDGE_*` still works as an alias.

  Migration: replace `/stacked-pr <sub>` with `/pr <sub>`. To keep the
  stacked workflow as your default everywhere, run
  `git config --global pr.mode stacked`.

- e5f6d8f: Remove the deprecated `commit-push-pr` and `pr-size-nudge` skills.

  Both were folded into the consolidated `pr` skill:

  - `commit-push-pr` → `/pr` in normal mode (commit conversation changes,
    push, open a single PR against the trunk).
  - `pr-size-nudge` → the PostToolUse diff-size nudge hook bundled with
    `pr` (`pr-nudge`).

  Migration: install `pr` (`npx skills add zcaceres/skills -s pr`) and run
  its `scripts/install.sh` for the always-on nudge. If you previously
  installed the standalone `pr-size-nudge` hook, remove its entry from
  `settings.json` so you don't get duplicate nudges.

- 9927057: Remove the `checkpoint` skill.

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

- 6ca6011: Add `pr` — bundles the full stacked-PR workflow as one skill
  with subcommands. This first cut ships:

  - `/pr checkpoint [description]` — ports the workflow from the
    former `checkpoint` skill (removed in the same release; see the
    `pr-remove-checkpoint` changeset). Cuts the uncommitted diff
    as the next branch in the stack, pushes it, opens a PR against the
    parent branch. Uses `git stack` when installed, else falls back to
    plain `gh` + `git`.
  - `/pr update [base-branch]` — ports the current
    `/commit-push-pr` workflow. Commits + pushes + updates the current
    branch's PR (or opens one if missing) without changing an existing
    PR's base.

  `/pr` with no subcommand defaults to `checkpoint`, so
  `/pr "add CSV export"` runs checkpoint with that as the slice
  description.

  Subsequent PRs in the consolidation stack add `submit`, `log`, `sync`,
  `merge`, and bundle the `pr-size-nudge` PostToolUse hook. The
  `checkpoint` skill is removed in the same release (see the
  `pr-remove-checkpoint` changeset). The other sibling skills
  (`commit-push-pr`, `pr-size-nudge`) remain installable for one release
  cycle, then will be removed.

### Minor Changes

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

- 15720ab: Add a `commit` alias for the everyday action. `/pr commit [message]` runs
  the active mode's default — `update` in normal mode, `checkpoint` in
  stacked mode — identical to bare `/pr`. It is deliberately mode-aware
  rather than a hard alias to `checkpoint`, so typing `/pr commit` in normal
  mode never forces stacked behavior. When `commit` is the first token, the
  remaining arguments seed the commit message / slice description.
- 9ebf36b: Provision the nudge hook binary on install/setup so the file-copy
  (`npx skills add`) experience actually works.

  The hook execs a compiled `scripts/bin/pr-nudge-<os>-<arch>` binary.
  Those are ~60 MB build artifacts — gitignored, never committed — so a
  pure file-copy install shipped the source and `run.sh` but no binary,
  leaving the hook a silent no-op. New `scripts/fetch-binary.sh` closes
  the gap. It is idempotent and layered: skip if the binary is already
  present → **download** the prebuilt binary for the host platform from
  the skill's GitHub release (`gh`) → **build** with `bun` → otherwise
  print manual steps. It is generic across every binary-bundling skill in
  the repo — it derives the skill name from its own path and globs the
  release asset by platform, so it needs no per-skill config. Overrides:
  `SKILL_BINARY_REPO` (default `zcaceres/skills`), `SKILL_BINARY_TAG`
  (default: latest `<skill>@*`).

  `install.sh` and `/pr setup` now call it, so wiring the hook also leaves
  it functional. The release pipeline (`.github/workflows/release.yml` and
  `scripts/release-skill.ts`) now publishes the per-platform binaries as
  individual, provenance-attested release assets for the download path to
  fetch.

- a477584: Bundle the `pr-size-nudge` PostToolUse hook into `pr`.

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

- a60c015: Add `merge` subcommand to `/pr`.

  `/pr merge [--merge|--rebase|--squash] [--all] [--dry-run]`
  lands the stack bottom-up with retarget verification between merges.
  Default strategy is `--merge` (preserves SHAs, child branches keep
  working). `--rebase`/`--squash` rewrite SHAs and trigger the
  rebase-onto-main dance for each remaining child PR. Refuses
  `--delete-branch` outright — it can auto-close child PRs
  irrecoverably.

  Prefers `git stack merge` when installed; otherwise walks the stack
  manually via `gh pr merge` + `gh pr edit --base main` + `git rebase
--onto`. `--dry-run` prints the plan without touching GitHub or the
  working tree.

  Also ships `references/recovery.md` covering the
  `--delete-branch`-closed-child-PR recovery procedure.

- 37b47bf: Add `submit`, `log`, and `sync` subcommands to `/pr`.

  - `/pr submit` — pure wrapper around `git stack submit`.
    Pushes every branch in the stack (force-with-lease) and
    creates/updates one GitHub PR per branch. Errors out with a clear
    "install `git stack`" message when the CLI isn't present rather
    than faking a multi-branch push with a `gh` loop.
  - `/pr log` — read-only stack visualization. Uses
    `git stack log` when installed, otherwise walks
    `branch.<name>.stack-parent` git config entries and composes the
    view from `gh pr list`.
  - `/pr sync [--no-push]` — fetch trunk and rebase every
    branch in the stack onto the updated tip. Uses `git stack sync`
    when installed, else walks the stack bottom-up rebasing each
    branch onto its parent. Refuses to run with a dirty tree; never
    auto-resolves conflicts.
