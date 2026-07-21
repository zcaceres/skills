# `/pr merge` — Land the PR(s) (jj)

This is the **jj** path. The GitHub side — `gh pr merge`, base retargeting,
the `--delete-branch` prohibition — is **identical** to the git path. Only
the local rebase plumbing differs: jj re-parents descendants in one
`jj rebase` with stable change IDs, so there is no tip-SHA snapshot and no
`rebase --onto` boundary arithmetic.

## Mode

- **normal mode** → merge the current branch's single PR:

  ```bash
  BR=$(jj log -r @ --no-graph -T 'bookmarks')   # or @- if @ is an empty working commit
  PR=$(gh pr list --head "$BR" --state open --json number -q '.[0].number')
  ```

  If there's no open PR, tell the user and stop. Otherwise merge with the
  chosen strategy (default `--merge`):

  ```bash
  gh pr merge "$PR" --merge   # or --rebase / --squash
  ```

  Do **not** pass `--delete-branch` unless the user explicitly asks.
  Report the merged PR URL, then stop.

- **stacked mode** → land the whole stack bottom-up (continue below).

## Stacked-mode workflow

Merge bottom-up, one PR at a time, verifying each child PR retargets to
the trunk before merging the next.

**Strategy matters** (same implications as the git path):

| Strategy | Flag | SHAs preserved? | Children need rebase? |
|---|---|---|---|
| Merge commit | `--merge` (default) | yes | no |
| Rebase merge | `--rebase` | no (rewritten) | yes |
| Squash merge | `--squash` | no (single new) | yes |

**Flags (passed through `$ARGUMENTS`):** `--merge` (default), `--rebase`,
`--squash`, `--all` (keep going until the stack is empty), `--dry-run`.

## Workflow

### 1. Detect the Trunk Bookmark

```bash
if   [ -n "$(jj bookmark list main   2>/dev/null)" ]; then TRUNK=main
elif [ -n "$(jj bookmark list master 2>/dev/null)" ]; then TRUNK=master
else echo "No trunk bookmark (main/master). Aborting." >&2; exit 1; fi
```

### 2. Fetch + Map the Stack

```bash
jj git fetch
jj log -r "${TRUNK}..@" --no-graph --reversed \
  -T 'bookmarks ++ "\t" ++ description.first_line() ++ "\n"'
```

Read this bottom (trunk-adjacent) → top. No pre-rebase SHA snapshot is
needed — jj tracks changes by stable change ID across rewrites.

### 3. Conflict Guard — Mandatory

Refuse to land anything if a stack change is conflicted:

```bash
if [ -n "$(jj log -r "conflicts() & (${TRUNK}..@)" --no-graph -T 'change_id.short()')" ]; then
  echo "Conflicted changes in the stack — resolve before merging." >&2
  exit 1
fi
```

### 4. `--dry-run` short-circuit

If `--dry-run` was passed, print the plan (stack bottom → top, each PR
number and base, the strategy, and the `gh pr merge` order) and stop
before any `gh pr merge` / `gh pr edit` / `jj rebase` / `jj git push`.

### 5. Land Bottom-Up

For each iteration, work on the **bottom-most remaining** slice.

```bash
BOTTOM=<bottom bookmark>
PR=$(gh pr list --head "$BOTTOM" --state open --json number -q '.[0].number')
```

Refuse if there's no open PR for `$BOTTOM`, or if `--delete-branch` was
passed (**never** use it — deleting a base branch can auto-close child
PRs irrecoverably).

**Strategy A: `--merge` (default, safest).** Preserves SHAs, so children
don't need rebasing:

```bash
gh pr merge "$PR" --merge
```

**Strategy B: `--rebase` / `--squash`.** Rewrites the bottom PR's SHAs as
it lands. Retarget the bottom PR to the trunk if needed, merge, then let
jj re-parent the rest onto the updated trunk:

```bash
gh pr merge "$PR" --rebase       # or --squash
jj git fetch                     # pick up the new trunk tip
NEXT=<next bookmark up, if any>
[ -n "$NEXT" ] && jj rebase -b "$NEXT" -d "$TRUNK"   # one op re-parents NEXT + all descendants
jj git push --all
```

Re-run the **conflict guard** (step 3) after this rebase before pushing.

### 6. Retarget the Next Child PR

GitHub auto-retarget is a repo setting, not the default — retarget
explicitly and verify:

```bash
NEXT_PR=$(gh pr list --head "$NEXT" --state open --json number -q '.[0].number')
if [ -n "$NEXT_PR" ]; then
  gh pr edit "$NEXT_PR" --base "$TRUNK"
  # confirm
  [ "$(gh pr view "$NEXT_PR" --json baseRefName -q .baseRefName)" = "$TRUNK" ] \
    || { echo "Retarget verification failed for #$NEXT_PR — stop"; exit 1; }
fi
```

### 7. Loop or Stop

If `--all` was not passed, stop after the bottom PR. Otherwise drop the
merged slice and repeat from step 5 until the stack is empty.

### 8. Report

- Which PRs merged (URLs)
- Which child PRs were retargeted to the trunk
- For `--rebase`/`--squash`: which slices jj re-parented
- Note that title markers read stale until the next `/pr submit`
  renumbers them (intentional).

## Important

- **Never** pass `--delete-branch` to `gh pr merge` — it can auto-close
  child PRs irrecoverably. See [recovery.md](../recovery.md).
- **Always** verify each child PR's base is the trunk before merging the
  next. Don't trust auto-retarget.
- Merge **bottom-up**. Top-down is never correct for stacks.
- The conflict guard is mandatory after every `jj rebase`.
- This subcommand does **not** rewrite the `[<name> N/M]` markers (see
  [title-convention.md](../title-convention.md)) — survivors read stale
  until the next `/pr submit`.
- If anything goes wrong, **stop**. [recovery.md](../recovery.md) covers
  the `--delete-branch` auto-close failure.
