# `/pr` with Jujutsu

Use this reference for every workflow command when the active backend is `jj`.
It defines `/pr` semantics and safety constraints, not a fixed shell script.
Choose commands that fit the installed jj version; consult `jj help` when flags
differ.

## Model

The jj backend requires a colocated `.jj` + `.git` repository:

- Use jj for the working copy, commits, rebases, bookmarks, fetches, and pushes.
- Use `gh` for GitHub PR operations.
- A jj bookmark is the Git branch GitHub sees.
- One bookmark represents one PR slice.
- Bookmark ancestry represents the PR stack.
- Keep the working-copy commit above the top slice.

Representative stack inspection uses bookmarked commits in `trunk()..@`, ordered
bottom to top. Validate the result rather than assuming every bookmark in the
repository belongs to the current stack.

## Setup

The normal activation path is `/pr setup jj`; see [setup.md](setup.md). In
summary:

```bash
jj --version
jj git init --colocate
git config --local pr.backend jj
```

Do not initialize jj implicitly during an ordinary `/pr` operation unless the
user has selected the jj backend.

## Shared pre-flight

Before a mutating workflow:

1. Inspect `jj st`, the relevant diff, and the local stack.
2. Identify the exact bookmarks that belong to this stack.
3. Require exactly one PR bookmark per slice. If a commit has multiple
   bookmarks, or stack identity is otherwise ambiguous, stop and ask.
4. Check for recorded conflicts and conflicted/divergent bookmarks before
   pushing or rewriting. jj can complete an operation while recording
   conflicts.
5. Commit only paths changed in this conversation. Pass explicit paths when
   unrelated working-copy changes exist.

After a fetch or rewrite, revalidate the previously identified bookmark names.
Do not use a repository-wide query to infer that unrelated bookmarks belong to
the current stack.

## `checkpoint`

Bare `/pr` and `/pr commit` map here too. Map this command to one or more local
jj slices:

1. Review the current diff and identify this conversation's paths.
2. Partition the diff by reviewer-meaningful concern, not line count. Each slice
   must have one primary purpose that can be explained, reviewed, and reverted
   independently. Normally separate mechanical renames/refactors,
   documentation, and behavior or business-logic changes; keep tests with the
   behavior they directly verify. A 400-line diff containing docs, a rename,
   and a business-logic change should normally become three slices.
3. If multiple concerns exist, propose a bottom-to-top stack plan and confirm it
   with the user. Do not commit the whole diff as one slice.
4. Commit each confirmed concern independently, using explicit paths or jj's
   interactive splitting facilities when concerns share files.
5. Ensure every completed commit has one appropriately named bookmark.
6. Leave a fresh working-copy commit on top.
7. Verify every completed slice and what remains in the working copy.

Typical operations are `jj commit` plus `jj bookmark create` or
`jj bookmark move`. Bookmarks do not automatically advance after every jj
operation, so verify where the bookmark points.

This command is local only. Do not push or open a PR; `/pr submit` is the
publish point.

## `update`

Map this command to updating the current bookmark's PR:

1. Identify the single bookmark representing the current PR. Stop if multiple
   bookmarks make that ambiguous.
2. Confirm that the uncommitted work belongs to that PR's single
   reviewer-meaningful concern. If it introduces a new concern or mixes
   independent concerns, do not broaden the PR; propose an ordered stack and
   use `checkpoint` after user confirmation.
3. Commit or squash this conversation's explicit paths into that slice.
4. Ensure the bookmark points to the updated slice, not the fresh working-copy
   commit.
5. Push the named bookmark.
6. Open a PR if missing; otherwise preserve its existing base.

If the bookmark belongs to a stack, preserve the stack ancestry and refresh the
published stack as needed. The Jujutsu backend may apply its title markers as
documented in [title-convention.md](title-convention.md). An explicit draft/ready
flag may update an existing PR's state; the configured draft default affects new
PRs only.

Always pass `--head <bookmark>` to `gh` because colocated Git may have detached
`HEAD`.

## `submit`

Map this command to publishing the whole identified stack:

1. Capture the intended bookmark chain bottom to top before fetching.
2. Require one bookmark per slice, descriptions for non-empty published
   changes, no recorded conflicts, and no unexpected uncheckpointed work.
3. Fetch, then revalidate those exact bookmarks. Stop on divergence or if a
   captured bookmark moved outside the expected ancestry; do not guess how to
   repair remote work.
4. Preview when practical, then push the named bookmarks explicitly. Do not
   push `@` or use auto-generated `--change` bookmark names.
5. For each bookmark bottom to top, create its PR if missing and set its base to
   the previous bookmark (trunk for the bottom PR). Retarget an existing PR only
   when its base no longer matches the current stack.
6. Apply the Jujutsu-only `[<name> N/M]` title markers from
   [title-convention.md](title-convention.md).

Use `gh pr create --head <bookmark> --base <previous>` explicitly. Re-running
`submit` should be idempotent.

## `sync`

Map this command to fetching and rebasing the current stack onto `trunk()`:

1. Capture the current stack bookmarks and check for pre-existing conflicts or
   divergence.
2. Fetch.
3. Rebase the stack onto `trunk()`; a single jj rebase can move all descendants.
4. Check again for recorded conflicts. Stop before pushing if any exist.
5. Push already-published bookmarks unless `--no-push` was passed.

If landed changes become empty during the rebase, inspect bookmarks that moved
to trunk. Clean up only bookmarks known to belong to landed slices. Keep cleanup
local; do not push bookmark deletions while child PRs may still depend on those
remote branches.

Report the resulting jj tree. Change IDs remain stable across rebases, so a SHA
translation table is unnecessary.

## `log`

This command is read-only:

1. Render the local tree from trunk through the working copy.
2. Identify the stack's bookmarks bottom to top.
3. Query `gh` for each bookmark's PR number, state, base, title, and URL.
4. Mark bookmarks with no remote branch or PR as unpublished.

Do not mutate, fetch, rebase, push, retarget, or rewrite titles from `log`.

## `merge`

Land the stack bottom-up. Respect an explicit `--merge`, `--rebase`, or
`--squash` flag and the repository's GitHub merge policy; repositories may
require squash or rebase merges.

Before each merge:

1. Identify the lowest remaining bookmark and its open PR.
2. Capture the exact change IDs and boundary of that PR slice before GitHub
   rewrites anything. This is required for safe squash/rebase handling.
3. Verify the PR targets trunk.
4. With `--dry-run`, report the plan and stop before any mutation.

Merge the PR with the selected strategy and never request remote branch
deletion. Then:

- **Merge commit:** fetch and rederive the surviving stack. The landed commits
  normally become ancestors of trunk without a local rewrite.
- **Squash or rebase:** GitHub rewrites the landed slice. Fetch, rebase the
  surviving stack onto the updated trunk, and check recorded conflicts before
  pushing. Use the pre-merge slice boundary to distinguish landed changes from
  survivors; never abandon a change unless it is proven to belong exclusively
  to the landed slice.

Before merging the next PR, retarget it to trunk when necessary and re-read its
`baseRefName` to verify the change. Without `--all`, merge only the bottom PR and
stop.

## Common edge cases

- **Detached Git HEAD:** normal in a colocated repo. Pass bookmark names
  explicitly to `gh`. If `gh pr merge` emits a detached-HEAD warning, verify the
  PR state before deciding the merge failed.
- **Recorded conflicts:** jj may return success while storing conflict markers.
  Check `conflicts()` before every push. Never auto-resolve.
- **Bookmark divergence after fetch:** stop rather than overwriting remote work.
  Ask how to reconcile the local and remote bookmark.
- **Working copy is mid-stack:** ancestry queries from `@` omit higher slices.
  Re-anchor a fresh working-copy commit above the intended top bookmark before
  continuing.
- **Non-empty working copy during submit:** warn that the work is not part of a
  bookmarked PR slice and ask whether to checkpoint it.
- **Bookmark aliases:** multiple bookmarks on one commit are ambiguous for
  `/pr`; ask which one represents the PR instead of treating aliases as
  separate stack entries.
- **Existing untracked remote bookmark:** track it only when intentionally
  adopting that remote branch; otherwise stop and explain the collision.
- **Landed bookmark at trunk:** delete or forget only the known local
  landed-slice bookmark. Never push its deletion while another PR uses it as a
  base.
- **Version differences:** prefer current `jj help` output over stale flag
  syntax while preserving the outcomes and safety constraints above.

## Report

Report the resulting stack or slice, every affected PR URL and base, the merge
strategy when relevant, and any retargeting or local bookmark cleanup performed.
