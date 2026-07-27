# `/pr checkpoint` (jj) — Cut the Current Slice as the Next Stacked Change

Commit the current working-copy changes as the next change in a stack and
leave the user on a fresh working-copy commit on top, ready to keep
working.

**Publishing is deferred.** This is a purely **local** operation — it does
**not** push or open a PR. You build the whole stack locally with repeated
checkpoints, then publish it as one finished set with
[`/pr submit`](submit.md). This keeps half-built, partial PRs from
accumulating on GitHub and confusing reviewers.

This is the jj-backend variant of [checkpoint.md](../checkpoint.md). There
is no tool-detect fork and no eager-publish fallback: jj itself records
the stack (ancestry is the parent relationship — no
`branch.<name>.stack-parent` config), and jj checkpoints are always
local-only.

**Slice description:** the dispatcher passes either the explicit text
after the `checkpoint` keyword, or — when invoked without a keyword —
the full `$ARGUMENTS`. Used as both the commit message and the source
for the auto-derived bookmark name. If empty, infer from the diff.

**Draft:** resolve draft intent (**draft** or **ready**) per
[SKILL.md → Determine draft intent](../../SKILL.md). Nothing is published
here, so drafts are applied when you publish the stack with
[`/pr submit`](submit.md) (see its draft-intent step).

## Workflow

### 1. Identify Your Changes

Review this conversation to identify which files YOU modified using Write
or Edit tools. Do NOT include:

- Files that were already modified before this conversation
- Changes made by other processes or previous sessions

List the files you changed and confirm with the user before proceeding.

### 2. Review the Diff

```bash
jj st
jj diff --stat
```

If the working copy is empty there is nothing to slice — check with:

```bash
jj log -r @ --no-graph -T 'if(empty, "EMPTY", "HAS CHANGES")'
```

Show the user the stat. Do **NOT** adjudicate coherence yourself. Only
pause to ask the user about slicing if the diff touches **more than 6
distinct top-level directories** — that's a cheap signal that multiple
concerns are mixed.

No fetch is needed here — nothing touches the remote until
[`/pr submit`](submit.md), which pre-flights drift itself.

### 3. Carve the Slice

If the slice description is empty, generate a concise
conventional-commit-style message from the diff (e.g. `feat: add user
repository`, `fix: handle null token in middleware`).

Commit **explicit paths only** — this is the jj equivalent of the "never
`git add .`" rule:

```bash
jj commit -m "<commit message>" <file1> <file2> ...
```

The named paths become the committed change (now `@-`); everything else
stays behind in the fresh working-copy commit (`@`). Never run a bare
`jj commit` while the working copy holds unrelated changes.

Verify the carve before building on it:

```bash
jj diff -r @- --summary    # the new slice — exactly your named files?
jj diff -r @  --summary    # what stayed behind in the working copy
```

If the split is wrong, `jj undo` reverses it — cheap now, expensive
after the next checkpoint stacks on top.

### 4. Bookmark the Slice

The bookmark is the branch GitHub will see — one bookmark per PR:

```bash
jj bookmark create <bookmark-name> -r @-
```

Generate the bookmark name from the commit message (slugified, e.g.
`feat/add-user-repository`). Never rely on `jj git push --change`
auto-generated `push-*` names — always name the bookmark.

### 5. Report

- The new bookmark name and change ID (`jj log -r @- --no-graph -T
  'change_id.shortest(8)'`).
- "Sliced locally — nothing pushed. Keep working; the next `/pr` (or
  `/pr checkpoint`) stacks on top. Run `/pr submit` to publish the whole
  stack when it's ready."

## Important

- NEVER commit files you didn't modify in this conversation.
- NEVER run a bare `jj commit` with no paths while unrelated changes are
  in the working copy — pass explicit files.
- Local only — never push from here. Publishing happens at
  [`/pr submit`](submit.md).
- **Bookmarks don't auto-advance.** If you later add another commit that
  belongs to this slice, either squash it into the bookmarked change
  (`jj squash --into <bookmark-name>` — the bookmark follows the rewrite
  automatically) or move the bookmark by hand:
  `jj bookmark move <bookmark-name> --to @-`. Always pass `--to` — its
  default is `@`, the (usually empty) working-copy commit.

## Publishing and Merging the Stack

When the stack is built, publish it all at once with
[`/pr submit`](submit.md). Then, when ready to land, use
[`/pr merge`](merge.md) — it merges the stack bottom-up, never uses
`--delete-branch`, and verifies each child's `baseRefName` is the trunk
before merging the next.
