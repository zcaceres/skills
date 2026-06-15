# commit-push-pr

Claude Code slash command for committing only the changes Claude made in
the current conversation, pushing them, and opening a PR if one doesn't
exist. Stack-aware: uses `git stack submit` when on a stacked branch,
otherwise plain `gh pr create`. **Preserves an existing PR's base
branch** — won't accidentally retarget a stacked PR to `main`.

**Usage:** `/commit-push-pr [base-branch]`

See [SKILL.md](./SKILL.md) for the full workflow, including the stack
detection and the rules around staging only your changes.

If you have uncommitted work that represents the *next slice* in a stack
(not the current branch's PR), use
[`/pr checkpoint`](../pr/) instead.

## Install

```sh
npx skills add zcaceres/skills -s commit-push-pr
```
## Origin

Ported from
[`zcaceres/claude-prs`](https://github.com/zcaceres/claude-prs)
into this monorepo. Body preserved verbatim; frontmatter adds
`disable-model-invocation: true` so the skill only fires when the user
explicitly types `/commit-push-pr`.
