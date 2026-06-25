---
"@zcaceres/skill-pr": minor
---

Stacked mode now builds locally and publishes once. On the `git stack` path,
`/pr checkpoint` only cuts the next branch locally (commit + recorded parent) and
no longer pushes or opens a PR — you build the whole stack with repeated
checkpoints, then `/pr submit` publishes it all at once, so half-built partial
PRs never accumulate on GitHub to confuse reviewers. (The `gh`-fallback
`checkpoint` still publishes eagerly for now; deferred publishing is git-stack
only.)

At publish time, `submit` stamps each PR's title with a `[<name> N/M]` marker
(e.g. `[ENG-456 2/4] Add token middleware`) so GitHub shows at a glance that a PR
belongs to a stack and where it sits — `<name>` is the ticket identifier the work
is tracked under (`[A-Z]{2,}-[0-9]+` found in the bottom branch name or its first
commit subject), falling back to a slug derived from the bottom branch, or an
explicit `branch.<bottom>.stack-label`; `N/M` is the position from the bottom over
the total. A new `references/title-convention.md` defines the format and a
self-contained, idempotent renumber routine run as a `gh pr edit` post-pass
(overriding git-stack's own titles). `merge` deliberately leaves markers alone, so
they read stale until the next `submit` refreshes them; single (non-stacked) PRs
never get a marker.
