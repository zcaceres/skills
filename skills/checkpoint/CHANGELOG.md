# @zcaceres/skill-checkpoint

## 1.0.0

### Major Changes

- Initial release: Claude Code slash command for shipping the current
  uncommitted slice as the next branch in a stack. Detects whether the
  [`git-stack`](https://github.com/zcaceres/git-stack) CLI is installed —
  if yes, uses `git stack create` + `git stack submit`; otherwise falls
  back to plain `gh pr create` against the parent branch. Refuses to stage
  unrelated changes (never `git add .`). Pure-markdown skill — no binaries.

  Ported from
  [`zcaceres/claude-stacked-prs`](https://github.com/zcaceres/claude-stacked-prs)
  into this monorepo. Body preserved verbatim; frontmatter adds
  `disable-model-invocation: true`.
