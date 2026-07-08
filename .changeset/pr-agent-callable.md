---
"@zcaceres/skill-pr": minor
---

Make `/pr` agent-callable. Dropped `disable-model-invocation: true` so an
agent working through a task can invoke the skill itself — the intended
use is checkpointing stacked PRs at each logical seam as work progresses,
not only responding to a user typing `/pr`. The description now tells the
model when to reach for it (`checkpoint`/`commit` to land a stacked slice,
`update` for a single PR) and an "applies to every subcommand" guardrail
keeps autonomous invocation safe: `merge` (lands PRs into trunk,
irreversible) and `setup` (flips the user's mode) run only when the user
explicitly asks.
