# gh-project-next

Pick the next card to work on from the repo's GitHub Projects kanban.
Ranks Todo cards by what's "logically next" using whatever organizational
signals the project actually uses (milestones with due dates, phase or
priority labels, age) and surfaces the top 3-5 with a one-line "why"
annotation so the ordering is auditable. Lets the user pick one, confirms
moving it to In Progress, and dumps the full card context.

Pass `--board-order` to skip ranking and use the raw kanban column order
(the previous default — useful when the user has already curated the board).

Stops at the context handoff — no branch creation, no edits, no planning.
Clean seam with `/checkpoint` for what comes after.

Activates on "what's next", "pick next ticket", "what should I work on",
or `/gh-project-next`.

Pure-prompt skill — uses the shared `.github/scripts/gh-project-board.sh`
installed by `/gh-project-setup`. Requires `.github/gh-project.json`.

See [SKILL.md](./SKILL.md) for the contextual ranking rules, the
candidate-display format, the auto-mode fallback for `/loop` use, and the
file-reference extraction heuristic.

## Install

```sh
npx skills add zcaceres/skills -s gh-project-next
```
