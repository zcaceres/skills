---
"@zcaceres/skill-gh-project": minor
---

Add a `batch` subcommand — `/gh-project batch <create|update|delete>` —
that applies one operation across many cards at once. It ingests the set
from an inline list, a file (JSON / Markdown / CSV), or a board `--query`,
previews the whole batch once, takes a single confirmation, then applies in
a continue-on-error loop and reports a per-item tally with the failed
remainder ready to re-run.

The mode is an envelope over the existing single-card workflows rather than
a reimplementation: `batch create` reuses `new-task`, `batch update` reuses
`update`, and `batch delete` reuses `delete` for the per-item `gh` recipes.
Resolution is backed by a new `find-many` subcommand in the board helper
(`gh-project-board.sh`) that resolves every selector against a single board
fetch — surfacing unresolved (`matchCount 0`) and ambiguous (`matchCount >
1`) selectors — instead of re-fetching the board once per selector. Batch
keeps every single-card safety rule: delete still requires a typed `yes`,
ambiguity is never auto-resolved across a set, and the "move finished cards
to Done, don't delete" norm is enforced on bulk deletes.
