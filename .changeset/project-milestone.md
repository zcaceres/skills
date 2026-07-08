---
"@zcaceres/skill-project": minor
---

Add a `milestone` subcommand — a canonical way to group work and execute toward
it, over either backend. A "milestone" maps to a GitHub repo milestone on the
github backend and to a Linear project on the linear backend.

Actions: `create` a milestone, `add` a card to one, `next` (rank a milestone's
open items and hand off the top one for execution, like `/project next` scoped to
the milestone), and `list`. New adapter verbs `create_milestone` /
`add_to_milestone` / `list_milestones` / `list_milestone_items` are documented per
backend in `references/backends/{github,linear}.md`.
