# @zcaceres/skill-stacked-pr

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
