# gh-project-review

Audit the repo's GitHub Projects kanban against the actual state of the
codebase, then update statuses one card at a time with explicit user
approval. Mirrors the structure of `/review-code-repro`: each
proposed change comes with cited code evidence and a yes/no/skip prompt.

Activates on "review the board", "audit the kanban", "what's stale on
the project", or `/gh-project-review`.

Pure-prompt skill — relies on `gh project item-list`, `gh issue view`,
`gh pr list`, `git log`, and `grep`/`rg`.

See [SKILL.md](./SKILL.md) for the evidence signals, verdict categories,
and the approval-loop format.

Requires `.github/gh-project.json` — run `/gh-project-setup` first.

## Install

```sh
npx skills add zcaceres/skills -s gh-project-review
```
