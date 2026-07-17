# `/pr checkpoint` — Cut the Current Slice as the Next Stacked Change (jj)

Commit the current uncommitted work as the next change in a stack and
leave the user ready to keep working on top. **Local only** — it does not
push or open a PR. Build the whole stack with repeated checkpoints, then
publish it as one set with [`/pr submit`](submit.md).

This is the **jj** path. jj's commit graph *is* the stack — there is no
external tool and no parent-pointer bookkeeping. A checkpoint is one
`jj split` plus a bookmark.

**Slice description:** the dispatcher passes either the explicit text
after the `checkpoint` keyword, or — when invoked without a keyword — the
full `$ARGUMENTS`. Used as the change description and the source for the
auto-derived bookmark name. If empty, infer from the diff.

**Draft:** drafts are applied when you publish with
[`/pr submit`](submit.md), not here — this path never publishes.

## The staging model — read this first

jj has **no index**, and the working copy `@` already contains *every*
change you've made, tracked automatically. So the safety rule is
inverted from git: instead of *adding* the files you want (`git add`), you
*carve off* the files you want into a new change and leave everything else
behind in `@`.

`jj split <paths>` moves **only the named paths** into a new commit; every
other change stays in the working copy. Naming paths explicitly is the
jj equivalent of "never `git add .`". A wrong split is reversible with
`jj undo`.

## Workflow

### 1. Identify Your Changes

Review this conversation to identify which files YOU modified using Write
or Edit tools. Do NOT include files changed before this conversation or by
other processes. List them and confirm with the user before proceeding.

### 2. Review the Diff

```bash
jj status
jj diff --stat -r @
```

Show the user the stat. Only pause to ask about slicing if the diff
touches **more than 6 distinct top-level directories** — a cheap signal
that multiple concerns are mixed.

### 3. Pre-flight: Fetch (optional)

```bash
jj git fetch    # only if a teammate may have moved trunk; safe to skip for a local checkpoint
```

### 4. Carve the Slice — `jj split` (local, no publish)

If the slice description is empty, generate a concise
conventional-commit-style message from the diff (e.g. `feat: add user
repository`).

```bash
jj split <file1> <file2> ... -m "<commit message>"
```

This creates a new change at `@-` containing **only** the named paths, and
leaves the working copy `@` holding everything else (your remaining,
uncommitted work). Verify the split did what you meant:

```bash
jj diff -r @- --summary    # the new slice — should be exactly your named files
jj diff -r @  --summary    # what's left behind in the working copy
```

If it's wrong, `jj undo` reverses the split.

### 5. Name the Slice with a Bookmark

Bookmarks do **not** auto-advance the way git branches do — the slice
needs one explicitly, so `submit` can push it and target its PR:

```bash
jj bookmark create <slug> -r @-     # <slug> derived from the message
```

Use a slugified form of the message (e.g. `feat-add-user-repository`).

**Do not** push or submit here — publishing is deferred to
[`/pr submit`](submit.md).

### 6. Report

- The new bookmark name and where `@` now sits (`jj log -r '@- | @'`).
- "Sliced locally — nothing pushed. Keep working in the working copy; the
  next `/pr` (or `/pr checkpoint`) stacks on top. Run `/pr submit` to
  publish the whole stack when it's ready."

## Important

- NEVER include a file you didn't modify in this conversation. Name paths
  explicitly in `jj split`; never carve the whole working copy into a
  slice with a bare `jj commit`.
- Local only — never `jj git push` here. Publishing happens at
  [`/pr submit`](submit.md).
- A wrong split is recoverable: `jj undo`.

## Publishing and Merging the Stack

When the stack is built, publish it all at once with
[`/pr submit`](submit.md). Then, when ready to land, use
[`/pr merge`](merge.md) — it merges bottom-up and verifies each child's
base retargeted to the trunk before merging the next.
