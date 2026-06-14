---
"@zcaceres/skill-review-code": minor
---

Consolidate the code-review trio into one `/review-code` skill with
subcommands, mirroring the `stacked-pr` and `gh-project` bundling. Bare
`/review-code` still runs the review (default subcommand); `repro` and
`fix` replace the standalone `review-code-repro` and `review-code-fix`
skills, whose packages are removed. The per-step workflows are ported
verbatim into `references/`. The pending changeset for the removed
packages is dropped with them.
