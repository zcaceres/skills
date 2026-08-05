# @zcaceres/skill-clean-ai-slop

## 2.0.1

### Patch Changes

- 4bc2b93: Adopt GitHub's first-party `gh stack` extension for git-backed stacked pull request workflows, and resolve diff bases from a branch's GitHub PR rather than obsolete local stack metadata.

## 2.0.0

### Major Changes

- 95ba984: Add clean-ai-slop — finds AI-generated noise in the current branch's diff,
  proposes each finding interactively, applies only what's approved, and
  verifies with the project's typecheck and tests. Scope: tombstone comments,
  restating-the-code comments, callsite references, emoji/em-dash tells,
  unused imports, dead internal symbols. Explicitly leaves `try/catch`,
  `any` casts, and redundant extractions alone — those belong to `/simplify`
  or `/code-review`. Ports the current `clean-ai-slop` slash command from
  `~/.claude/commands/`.
