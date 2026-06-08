# @zcaceres/skill-stacked-pr

## 1.3.0

### Minor Changes

- Bundle the `pr-size-nudge` PostToolUse hook into the skill.

  The hook source (`scripts/index.ts`), prebuilt binaries
  (`scripts/bin/stacked-pr-nudge-{linux-x64,darwin-arm64,windows-x64.exe}`),
  launcher scripts (`scripts/run.sh`, `scripts/run.cmd`), and tests
  now ship with `stacked-pr`. The nudge text points at
  `/stacked-pr checkpoint`.

  Env vars and state file are namespaced to `stacked-pr-nudge` so the
  bundled hook coexists with an older standalone `pr-size-nudge`
  install during the deprecation window — but if both are wired in
  `settings.json`, you'll get double nudges. Remove the old entry
  before adding this one. Legacy `PR_NUDGE_*` env vars are still
  honored as fallbacks.

  The `hooks:` frontmatter block is included for forward compatibility,
  but Claude Code does not yet substitute `${CLAUDE_SKILL_DIR}` in
  frontmatter hook commands — manual wiring via `settings.json` is
  still required. See [references/nudge.md](references/nudge.md).

  Also adds deprecation banners to the three original sibling skills
  (`checkpoint`, `commit-push-pr`, `pr-size-nudge`). They remain
  installable for one release cycle.

## 1.2.0

### Minor Changes

- Add `merge` subcommand.

  `/stacked-pr merge [--merge|--rebase|--squash] [--all] [--dry-run]`
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

## 1.1.0

### Minor Changes

- Add `submit`, `log`, and `sync` subcommands.

  - `/stacked-pr submit` — pure wrapper around `git stack submit`.
    Pushes every branch in the stack (force-with-lease) and
    creates/updates one GitHub PR per branch. Errors out with a clear
    "install `git stack`" message when the CLI isn't present rather
    than faking a multi-branch push with a `gh` loop.
  - `/stacked-pr log` — read-only stack visualization. Uses
    `git stack log` when installed, otherwise walks
    `branch.<name>.stack-parent` git config entries and composes the
    view from `gh pr list`.
  - `/stacked-pr sync [--no-push]` — fetch trunk and rebase every
    branch in the stack onto the updated tip. Uses `git stack sync`
    when installed, else walks the stack bottom-up rebasing each
    branch onto its parent. Refuses to run with a dirty tree; never
    auto-resolves conflicts.

## 1.0.0

### Major Changes

- Initial release: consolidates the three sibling stacked-PR skills
  (`checkpoint`, `commit-push-pr`, `pr-size-nudge`) into a single
  `/stacked-pr <sub>` skill. This first cut ships the `checkpoint` and
  `update` subcommands, ported from `checkpoint/SKILL.md` and
  `commit-push-pr/SKILL.md` respectively. `/stacked-pr` with no
  subcommand (or with a quoted description) defaults to `checkpoint`.

  Detects whether the
  [`git-stack`](https://github.com/zcaceres/git-stack) CLI is installed
  — if yes, prefers its primitives; otherwise falls back to plain `gh`
  + `git`. Refuses to stage unrelated changes (never `git add .`).

  Pure-markdown so far — no binaries. The PostToolUse hook from
  `pr-size-nudge` joins in a later PR.
