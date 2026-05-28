# @zcaceres/skill-commit-push-pr

## 1.0.0

### Major Changes

- Initial release: Claude Code slash command for committing the
  conversation's changes, pushing them, and opening a PR if one doesn't
  exist. Stack-aware: uses `git stack submit` when on a stacked branch,
  otherwise plain `gh pr create`. **Preserves an existing PR's base branch**
  — won't accidentally retarget a stacked PR to `main`. Pure-markdown skill
  — no binaries.

  Ported from
  [`zcaceres/claude-stacked-prs`](https://github.com/zcaceres/claude-stacked-prs)
  into this monorepo. Body preserved verbatim; frontmatter adds
  `disable-model-invocation: true`.
