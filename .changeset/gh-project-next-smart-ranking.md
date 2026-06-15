---
"@zcaceres/skill-gh-project": minor
---

gh-project-next now ranks Todo cards by what's "logically next" by default,
using whatever organizational signals the project actually uses (milestones
with due dates, phase/priority labels, age) and showing a one-line "why"
per candidate. Pass `--board-order` to restore the previous behavior of
listing cards in raw kanban column order.
