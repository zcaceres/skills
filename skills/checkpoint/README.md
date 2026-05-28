# checkpoint

Claude Code slash command for shipping the current uncommitted slice as
the next branch in a stack. Detects whether the
[`git-stack`](https://github.com/zcaceres/git-stack) CLI is installed —
if yes, uses `git stack create` + `git stack submit`; otherwise falls
back to plain `gh pr create` against the parent branch.

**Usage:** `/checkpoint [slice description]`

See [SKILL.md](./SKILL.md) for the full workflow, the gh fallback path,
and the stack-merge guide.

## Install

```sh
skills install @zcaceres/checkpoint
```

Or grab the tarball from the latest
[GitHub release](https://github.com/zcaceres/skills/releases?q=checkpoint).

Best paired with:
- [`commit-push-pr`](../commit-push-pr/) — commit + push without creating
  a new stack branch.
- [`pr-size-nudge`](../pr-size-nudge/) — PostToolUse hook that suggests
  `/checkpoint` when the uncommitted diff grows large.
- `git stack` CLI — install separately from
  [`zcaceres/git-stack`](https://github.com/zcaceres/git-stack) releases.
  Optional; the slash command falls back to `gh` + `git` if not present.

## Origin

Ported from
[`zcaceres/claude-stacked-prs`](https://github.com/zcaceres/claude-stacked-prs)
into this monorepo. Body preserved verbatim; frontmatter adds
`disable-model-invocation: true` so the skill only fires when the user
explicitly types `/checkpoint`.
