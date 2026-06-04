# gh-project-new-task

Create a new card on the repo's GitHub Projects kanban. Defaults to creating
a real GitHub issue (so the card is also a first-class issue), can opt into
a project-only draft, and supports an optional milestone.

Activates on "new task", "add a card", "create a project task", or
`/gh-project-new-task`.

Pure-prompt skill — relies on `gh issue create` and `gh project item-create`.

See [SKILL.md](./SKILL.md) for the full command set, mode comparison
(issue vs draft), and limitations of each mode.

Requires `.github/gh-project.json` to exist — run `/gh-project-setup` first.

## Install

```sh
npx skills add zcaceres/skills -s gh-project-new-task
```
