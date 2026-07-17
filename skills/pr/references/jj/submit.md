# `/pr submit` — Publish the Whole Stack (jj)

**This is the publish point for a stack.** Checkpoints are built locally
and unpublished (see [`/pr checkpoint`](checkpoint.md)); `submit` pushes
every slice's bookmark, opens one GitHub PR per slice (each targeting the
slice below it), and stamps the `[<name> N/M]` title markers — so the
finished stack reaches GitHub as one coherent set. Idempotent — safe to
re-run after a `sync` or after adding more checkpoints.

This is the **jj** path. Unlike the git path, it needs no external tool:
the commit graph is the stack, and `jj git push` publishes it. The
GitHub layer (`gh pr create`/`edit`) is identical to the git path.

## Flags (passed through `$ARGUMENTS`)

- `--draft` — open the stack's PRs as **drafts**. Adds `--draft` to
  `gh pr create` for every PR this run *creates*. Existing PRs are left
  as-is (`--draft` never converts an already-open PR back to draft). Also
  implied when `pr.draft true` is configured (see
  [SKILL.md → Determine draft intent](../../SKILL.md#determine-draft-intent)),
  unless overridden by `--ready`/`--no-draft` on the invocation.

## Workflow

### 1. Detect the Trunk Bookmark

`trunk()` is unreliable without a remote (it falls back to the root
commit), so detect the trunk bookmark explicitly — non-empty output, not
exit code (`jj bookmark list <name>` exits 0 even when absent):

```bash
if   [ -n "$(jj bookmark list main   2>/dev/null)" ]; then TRUNK=main
elif [ -n "$(jj bookmark list master 2>/dev/null)" ]; then TRUNK=master
else echo "No trunk bookmark (main/master). Aborting." >&2; exit 1; fi
```

### 2. Verify You're In a Stack

```bash
jj log -r "${TRUNK}..@" --no-graph --reversed \
  -T 'change_id.short() ++ "\t" ++ bookmarks ++ "\t" ++ description.first_line() ++ "\n"'
```

Each line is a slice, bottom (trunk-adjacent) → top. If it's empty, `@`
is at or below the trunk — there's nothing to submit. Tell the user to
build slices with `/pr checkpoint` first, then stop.

### 3. Ensure Every Slice Has a Bookmark

`submit` publishes bookmarks; a slice without one can't become a PR. For
each slice change with an empty bookmark column, create one (slug from
its description) before pushing:

```bash
jj bookmark create <slug> -r <change-id>
```

If a slice is missing a bookmark and you can't infer a good name, ask the
user rather than guessing.

### 4. Conflict Guard — Mandatory

jj records conflicts **inside commits** and a rebase never halts, so a
conflicted change can otherwise be pushed to GitHub silently. Refuse to
publish if any change in the stack is conflicted:

```bash
if [ -n "$(jj log -r "conflicts() & (${TRUNK}..@)" --no-graph -T 'change_id.short()')" ]; then
  echo "Conflicted changes in the stack — resolve them before submitting." >&2
  jj log -r "conflicts() & (${TRUNK}..@)"
  exit 1
fi
```

Stop and surface the conflicted changes; do not push.

### 5. Pre-flight: Fetch + Dry-Run

```bash
jj git fetch
jj git push --all --dry-run    # or push specific bookmarks; preview what would move
```

If any bookmark has diverged from its remote (a teammate pushed), pause
and ask how to reconcile before pushing.

### 6. Push the Stack

Push every stack bookmark. `jj git push` tracks remote bookmarks, so it
is safe without git's `--force-with-lease` dance:

```bash
jj git push --bookmark <slug1> --bookmark <slug2> ...   # or --all if the repo has only this stack
```

### 7. Open / Update One PR per Slice

For each slice bottom → top, resolve its **parent bookmark** and
create-or-update its PR targeting that parent:

```bash
# parent bookmark of <slug> = nearest bookmarked ancestor
PARENT=$(jj log -r "heads(::<slug>- & bookmarks())" --no-graph -T 'bookmarks')

# existing PR?
PR=$(gh pr list --head "<slug>" --state open --json number -q '.[0].number')
if [ -z "$PR" ]; then
  gh pr create --head "<slug>" --base "$PARENT" --fill    # add --draft when draft intent is draft
else
  # keep base in sync with the (possibly changed) parent
  gh pr edit "$PR" --base "$PARENT"
fi
```

The bottom slice's parent is the trunk bookmark itself.

### 8. Renumber Stack Title Markers

Run the renumber routine from
[title-convention.md](../title-convention.md) so every PR's title carries
its `[<name> N/M]` marker, accurate for the current stack size.

### 9. Report

One line per PR — title (marker included), URL, base — bottom → top, e.g.:

```
#42  [auth 1/3] Add token model        base: main          (bottom)  https://…/42
#43  [auth 2/3] Add token middleware    base: feat-token-model         https://…/43
#44  [auth 3/3] Wire into the router    base: feat-token-mw  (top)     https://…/44
```

## Important

- The conflict guard (step 4) is not optional — jj will happily push a
  conflicted commit otherwise.
- If a `gh pr create`/`edit` call fails mid-way, stop and surface the
  error. Don't retry blindly.
- Don't rewrite or amend changes here. Use `/pr checkpoint`,
  `/pr update`, or `/pr sync` for those.
