# Stacked-PR Title Markers (Jujutsu Backend Only)

The git backend uses GitHub's native `gh stack` representation and **must not**
add stack-position markers to pull-request titles. GitHub displays the stack,
its order, and navigation in the pull-request UI.

This document applies only to the optional colocated Jujutsu backend, which does
not use `gh stack` local tracking. It may use the following marker so its
independently published PRs remain identifiable in a GitHub list:

```
[<name> N/M] <your real title>
```

- `<name>` is a stable name for the whole stack, preferably its ticket ID.
- `N` is the layer's position from the bottom.
- `M` is the total number of published layers.

Only rewrite the marker prefix; preserve the actual PR title. Apply markers only
after the Jujutsu backend publishes or republishes a stack, and never as part of
merging. A stack that has shrunk can retain stale markers until its next submit.

## Jujutsu procedure

Derive the current stack from bookmarked commits in `trunk()..@`, bottom to top,
and require exactly one PR bookmark per slice. In a colocated repository those
bookmarks are exposed as Git branches, so query each PR with `gh pr list` and
update its title with `gh pr edit`.

Use a ticket identifier from the bottom bookmark or its first commit subject
when available; otherwise use the bottom bookmark's final path component. An
explicit per-stack label may be stored in
`branch.<bottom-branch>.stack-label` for the Jujutsu workflow.

Do not use this convention on the git backend or invoke it after `gh stack
submit`.
