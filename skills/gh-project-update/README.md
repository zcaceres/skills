# gh-project-update

Update an existing card on the repo's GitHub Projects kanban — title, body,
or status — folding in context from the current conversation. Accepts an
explicit identifier (item id, issue number, or title) or infers the target
from the conversation when invoked bare.

Activates on "/gh-project-update", "/gh-project-update <id|title>",
"update card N", or "update that task with what we just learned".

Pure-prompt skill — relies on `gh project item-edit`, `gh issue edit`, and
`gh project item-list` for lookup.

See [SKILL.md](./SKILL.md) for the identifier resolution rules, the
one-field-per-invocation gotcha when editing issue-backed items, and the
default-append behavior for bodies.

Requires `.github/gh-project.json` — run `/gh-project-setup` first.

## Install

```sh
npx skills add zcaceres/skills -s gh-project-update
```
