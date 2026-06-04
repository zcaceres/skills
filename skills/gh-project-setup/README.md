# gh-project-setup

Bootstrap a GitHub Projects (v2) kanban board for the current repo. Creates
the project, links it to the repo, captures the Status field + option IDs,
and writes `.github/gh-project.json` so the sibling `gh-project-*` skills
can find the board.

Activates on "set up a project board", "create a kanban", "init gh project",
or `/gh-project-setup`.

Pure-prompt skill — no scripts, no binaries. Relies on the `gh` CLI with
the `project` scope.

See [SKILL.md](./SKILL.md) for the workflow and the four-IDs cheat sheet
(project number vs node ID vs field ID vs option ID) that other agents
trip over.

## Install

```sh
npx skills add zcaceres/skills -s gh-project-setup
```
