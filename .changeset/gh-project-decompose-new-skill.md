---
"@zcaceres/skill-gh-project-decompose": minor
---

New skill `gh-project-decompose` — breaks a large card on the GitHub Projects
kanban into smaller subtask cards through a collaborative proposal-and-refine
loop. Drafts 3–7 subtasks from the parent body, lets the user reshape the
batch (drop, merge, edit, regenerate, accept), then creates the children,
links them via GitHub's sub-issues API plus a checklist appended to the
parent body, and optionally moves the parent to In Progress.
