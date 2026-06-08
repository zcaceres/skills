# gh-project-decompose

Break a large card on the repo's GitHub Projects kanban into smaller subtask
cards through a collaborative proposal-and-refine loop. Drafts 3–7 subtasks
from the parent body, lets the user reshape the batch (drop, merge, edit,
regenerate), then creates the children, links them to the parent via
GitHub's sub-issues API and a body checklist, and optionally moves the
parent to In Progress.

Activates on "/gh-project-decompose", "/gh-project-decompose <id|title>",
"decompose this card", "break this into subtasks", "split this task", or
"make these into sub-issues".

Pure-prompt skill — relies on `gh issue create`, `gh issue edit`,
`gh project item-create`, `gh project item-edit`, and the
`POST /repos/.../issues/{n}/sub_issues` REST endpoint via `gh api`.

See [SKILL.md](./SKILL.md) for the batched-approval workflow, the slicing
heuristics (independently shippable, reviewer-friendly, sequenced), and the
two-mechanism linking strategy (sub-issues API + parent body checklist).

Requires `.github/gh-project.json` — run `/gh-project-setup` first.

## Install

```sh
npx skills add zcaceres/skills -s gh-project-decompose
```
