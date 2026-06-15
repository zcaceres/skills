---
"@zcaceres/skill-pr": minor
---

Add `merge` subcommand to `/pr`.

`/pr merge [--merge|--rebase|--squash] [--all] [--dry-run]`
lands the stack bottom-up with retarget verification between merges.
Default strategy is `--merge` (preserves SHAs, child branches keep
working). `--rebase`/`--squash` rewrite SHAs and trigger the
rebase-onto-main dance for each remaining child PR. Refuses
`--delete-branch` outright — it can auto-close child PRs
irrecoverably.

Prefers `git stack merge` when installed; otherwise walks the stack
manually via `gh pr merge` + `gh pr edit --base main` + `git rebase
--onto`. `--dry-run` prints the plan without touching GitHub or the
working tree.

Also ships `references/recovery.md` covering the
`--delete-branch`-closed-child-PR recovery procedure.
