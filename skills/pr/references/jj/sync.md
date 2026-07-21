# `/pr sync` — Rebase the Stack onto Updated Trunk (jj)

Fetch the trunk and rebase the whole stack onto its updated tip. Use
after the trunk has moved (a sibling PR merged) and the stack needs to
absorb those changes.

This is the **jj** path. jj auto-rebases descendants, so syncing a stack
is one `jj rebase` — there is no per-branch loop and no force-push dance.

**Flags (passed through `$ARGUMENTS`):**

- `--no-push` — rebase locally without pushing. Useful to inspect or test
  the rebased stack first.

## Workflow

### 1. Detect the Trunk Bookmark

```bash
if   [ -n "$(jj bookmark list main   2>/dev/null)" ]; then TRUNK=main
elif [ -n "$(jj bookmark list master 2>/dev/null)" ]; then TRUNK=master
else echo "No trunk bookmark (main/master). Aborting." >&2; exit 1; fi
```

> No clean-tree pre-check is needed. jj has no dirty working state to
> lose — the working copy `@` is itself a commit, and rebase preserves it.

### 2. Fetch Trunk

```bash
jj git fetch
```

This updates the trunk bookmark to its new remote tip.

### 3. Find the Bottom Slice + Rebase

The bottom slice is the trunk-adjacent one:

```bash
BOTTOM=$(jj log -r "${TRUNK}..@" --no-graph --reversed \
  -T 'bookmarks ++ "\n"' | head -1)
```

Rebase it onto the updated trunk. Every descendant follows automatically:

```bash
jj rebase -b "$BOTTOM" -d "$TRUNK"
```

`-b` moves the whole branch (the bottom slice and everything built on it)
onto the new trunk tip. Siblings and children are re-parented in one
operation — no recursion, no per-branch force-push.

### 4. Conflict Guard — Mandatory

A jj rebase **succeeds even when it produces conflicts**, recording them
inside the rebased commits. Check before pushing:

```bash
if [ -n "$(jj log -r "conflicts() & (${TRUNK}..@)" --no-graph -T 'change_id.short()')" ]; then
  echo "Rebase produced conflicts. Resolve them, then re-run /pr sync." >&2
  jj log -r "conflicts() & (${TRUNK}..@)"
  exit 1
fi
```

Surface the conflicted changes and stop. Do not push. To resolve: edit
the conflicted change (`jj edit <change>`), fix the markers, then re-run
`/pr sync`. Do not auto-resolve.

### 5. Push (unless `--no-push`)

If `--no-push` was passed, stop here and report the rebased changes and
their new positions (`jj log`).

Otherwise push the whole stack. `jj git push` compares against tracked
remote bookmarks, so it's safe without an explicit lease:

```bash
jj git push --all      # or --bookmark <slug> per stack bookmark
```

### 6. Report

For each slice, show its new position (`jj log -r "${TRUNK}..@"`). Note
that GitHub PRs pick up the new tips automatically — no manual retargeting
for `sync` (unlike `merge --rebase`/`--squash`).

## Important

- The conflict guard (step 4) is mandatory — jj rebases don't stop on
  conflict, so without it you'd push conflicted commits.
- Never auto-resolve conflicts. Surface them and stop.
- If the trunk moved a lot, expect conflicts to surface in the rebased
  changes. Tell the user up front.
