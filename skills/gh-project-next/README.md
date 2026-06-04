# gh-project-next

Pick the next card to work on from the repo's GitHub Projects kanban.
Surfaces the top 3-5 Todo cards with body previews and signals (milestone,
labels, age), lets the user pick one, confirms moving it to In Progress,
and dumps the full card context so the agent can start work.

Stops at the context handoff — no branch creation, no edits, no planning.
Clean seam with `/checkpoint` for what comes after.

Activates on "what's next", "pick next ticket", "what should I work on",
or `/gh-project-next`.

Pure-prompt skill — uses the shared `.github/scripts/gh-project-board.sh`
installed by `/gh-project-setup`. Requires `.github/gh-project.json`.

See [SKILL.md](./SKILL.md) for the candidate-display format, the auto-mode
fallback for `/loop` use, and the file-reference extraction heuristic.

## Install

```sh
npx skills add zcaceres/skills -s gh-project-next
```
