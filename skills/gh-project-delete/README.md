# gh-project-delete

Remove a card from the repo's GitHub Projects kanban, identified by item id,
issue number, or title. Always shows the full card and asks for explicit
confirmation before deleting. Spells out the difference between deleting a
draft (destructive) and unlinking an issue (recoverable).

Activates on "/gh-project-delete [id|title]", "delete card N", or
"remove this task from the board".

Pure-prompt skill — relies on `gh project item-list` for lookup,
`gh project item-delete` for the unlink/delete, and optionally
`gh issue close`/`gh issue delete` for the underlying issue.

See [SKILL.md](./SKILL.md) for the resolution rules, the per-card-type
"what does delete actually do" matrix, and the mandatory confirmation gate.

Requires `.github/gh-project.json` — run `/gh-project-setup` first.

## Install

```sh
npx skills add zcaceres/skills -s gh-project-delete
```
