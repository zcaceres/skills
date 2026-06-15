---
"@zcaceres/skill-gh-project": minor
---

New skill `gh-project` — consolidates the seven `gh-project-*` skills
(`setup`, `next`, `new-task`, `update`, `review`, `decompose`, `delete`)
into a single skill with subcommands, mirroring the `pr` bundling.
Invoke as `/gh-project <subcommand> [args]`; bare `/gh-project` prints the
subcommand list. The per-subcommand workflows are ported verbatim into
`references/`, and the shared `gh-project-board.sh` helper now ships with
this skill. The seven standalone `gh-project-*` packages are removed.
