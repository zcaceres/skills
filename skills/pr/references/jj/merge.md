# `/pr merge` (jj) — Land the PR(s)

This is the jj-backend variant of [merge.md](../merge.md). The GitHub
side — bottom-up merging, retarget verification, the strategy table — is
identical; what disappears is the local SHA bookkeeping (change IDs are
stable across rewrites) and the per-branch rebase dance.

## Mode

- **normal mode** → merge the current bookmark's single PR. No stack
  bookkeeping needed. Resolve the bookmark (colocated git `HEAD` is
  detached, so `gh` can't infer the branch):

  ```bash
  BRANCH=$(jj log -r 'heads(::@ & bookmarks())' --no-graph \
    -T 'local_bookmarks.map(|b| b.name()).join(" ")')
  PR=$(gh pr list --head "$BRANCH" --state open --json number -q '.[0].number')
  ```

  If there's no open PR, tell the user and stop. Otherwise merge with the
  user's chosen strategy (default `--merge`; `--rebase`/`--squash` if they
  asked):

  ```bash
  gh pr merge "$PR" --merge   # or --rebase / --squash
  ```

  Do **not** pass `--delete-branch` unless the user explicitly asks. Report
  the merged PR URL, then stop — the rest of this file is the stacked-mode
  workflow.

- **stacked mode** → land the whole stack bottom-up (continue below).

## Stacked-mode workflow

Merge the stack bottom-up, one PR at a time, with retarget verification
between each step.

**Strategy matters.** Each one has different implications for stacked
PRs:

| Strategy | Flag | SHAs preserved? | Child branches break? | Restack needed? |
|---|---|---|---|---|
| Merge commit | `--merge` (default) | yes | no | no |
| Rebase merge | `--rebase` | no (rewritten) | yes | yes (one `jj rebase`) |
| Squash merge | `--squash` | no (single new) | yes | yes (one `jj rebase`) |

**Flags (passed through `$ARGUMENTS`):**

- `--merge` (default) — merge commit strategy. Safest for stacks.
- `--rebase` — rebase merge. Triggers one whole-stack restack per landed
  PR.
- `--squash` — squash merge. Same as `--rebase` for stack handling.
- `--all` — keep merging until the stack is empty. Without this,
  merges one PR (the bottom of the stack) and stops.
- `--dry-run` — print the plan without merging anything.

### 1. Pre-flight

```bash
jj git fetch

# Conflicted commits or divergent bookmarks — resolve before landing.
jj log -r 'trunk()..@ & conflicts()'
jj bookmark list --conflicted
```

If either guard prints anything, surface it and stop. Then derive the
stack (bottom → top) and the trunk name:

```bash
STACK=($(jj log -r 'trunk()..@ & bookmarks()' --no-graph --reversed \
  -T 'local_bookmarks.map(|b| b.name()).join(" ") ++ "\n"'))

if git rev-parse --verify origin/main >/dev/null 2>&1; then
  TRUNK=main
elif git rev-parse --verify origin/master >/dev/null 2>&1; then
  TRUNK=master
else
  echo "Couldn't detect trunk (neither origin/main nor origin/master). Aborting." >&2
  exit 1
fi
```

There is **no SHA capture step** — change IDs survive rewrites, and the
restack below is a single `jj rebase` with no hand-computed boundaries.

### 2. `--dry-run` short-circuit

If the user passed `--dry-run`, print the plan and stop *here*, before
any destructive command runs. Do **not** call `gh pr merge`,
`gh pr edit`, `jj rebase`, or `jj git push`. Show:

- The stack (bottom → top) with each bookmark's PR number and current
  base
- Which strategy will be used
- For `--rebase`/`--squash`: that the surviving stack will be restacked
  onto trunk and re-pushed after each landing
- The order of `gh pr merge` calls

Stop without changes.

### 3. Merge Loop

Walk the stack bottom-up. For each iteration, work on the
*lowest-remaining* bookmark.

#### Common pre-checks (every iteration)

```bash
BOTTOM="${STACK[0]}"
PR_NUMBER=$(gh pr list --head "$BOTTOM" --state open --json number -q '.[0].number')
PR_BASE=$(gh pr view "$PR_NUMBER" --json baseRefName -q '.baseRefName')
```

Refuse to proceed if:

- No open PR exists for `$BOTTOM` — tell the user.
- `--delete-branch` was passed — error out. **Never** use it; deleting
  a base branch can auto-close child PRs irrecoverably.

#### Strategy A: `--merge` (default, safest)

```bash
gh pr merge "$PR_NUMBER" --merge
```

Do **NOT** use `--delete-branch`. Then verify the next child PR (if
any) was retargeted — GitHub auto-retarget is a repo setting, not the
default:

```bash
NEXT="${STACK[1]}"
if [[ -n "$NEXT" ]]; then
  NEXT_PR=$(gh pr list --head "$NEXT" --state open --json number -q '.[0].number')
  NEXT_BASE=$(gh pr view "$NEXT_PR" --json baseRefName -q '.baseRefName')
  if [[ "$NEXT_BASE" != "$TRUNK" ]]; then
    gh pr edit "$NEXT_PR" --base "$TRUNK"
  fi
  # Re-read to confirm
  NEXT_BASE=$(gh pr view "$NEXT_PR" --json baseRefName -q '.baseRefName')
  if [[ "$NEXT_BASE" != "$TRUNK" ]]; then
    echo "Retarget verification failed for PR #$NEXT_PR — refusing to continue"
    exit 1
  fi
fi
```

Then:

```bash
jj git fetch
```

`--merge` preserves the landed commits' SHAs, so they become ancestors
of trunk and no local rebase is needed at all — re-deriving `STACK`
(after-each-merge step below) drops the landed slice from
`trunk()..@ & bookmarks()` automatically. The stack self-heals.

#### Strategy B: `--rebase` or `--squash` (SHA-rewriting)

These rewrite the bottom PR's commits as they land on trunk, so the
surviving stack needs one restack per landing:

```bash
# The bottom PR's base should already be trunk; if it isn't, retarget
# before merging.
if [[ "$PR_BASE" != "$TRUNK" ]]; then
  gh pr edit "$PR_NUMBER" --base "$TRUNK"
fi

gh pr merge "$PR_NUMBER" --rebase   # or --squash
```

Retarget the next child to trunk (same retarget-and-verify block as
Strategy A) **before** rewriting anything locally. Then restack:

```bash
jj git fetch
jj rebase -d 'trunk()' --skip-emptied
jj log -r 'trunk()..@ & conflicts()'   # stop before pushing if anything prints
jj git push -r 'trunk()..@'
```

One `jj rebase` restacks *all* surviving changes at once — the landed
slice's local commits become empty, are abandoned by `--skip-emptied`,
and **their bookmark is deleted locally with them**. That's expected;
report it. (On an older jj that leaves the bookmark behind, delete it
locally with `jj bookmark delete <name>`.) With `--all`, later
iterations' rebase is a near-no-op that just drops each newly landed
slice.

> **Never push bookmark deletions.** After `--skip-emptied` removes a
> landed slice's local bookmark, `jj git push --deleted` (or
> `-b <that-name>`) would delete the **remote** branch — which is
> `--delete-branch` in disguise and can auto-close child PRs. See
> [recovery.md](../recovery.md) if it already happened.

#### After each merge

```bash
jj git fetch
STACK=($(jj log -r 'trunk()..@ & bookmarks()' --no-graph --reversed \
  -T 'local_bookmarks.map(|b| b.name()).join(" ") ++ "\n"'))
```

Re-deriving replaces the array-shift — the landed slice is gone from the
range. If the repo auto-deletes branches on merge, the fetch also
removes the landed slice's tracked bookmark locally; that's expected,
not an error.

If `--all` was not passed, stop here.
If `STACK` is empty, the stack is fully landed; stop.
Otherwise, loop.

### 4. Report

Print:

- Which PRs merged (URLs)
- Which child PRs were retargeted to trunk
- For `--rebase`/`--squash`: that the surviving stack was restacked and
  re-pushed, and which bookmarks were dropped as landed — those are
  already cleaned up locally (jj deletes a bookmark with its abandoned
  commit); no `git branch -D` chore
- For `--merge`: nothing is abandoned, so each landed bookmark survives
  locally unless the repo auto-deletes merged branches (in which case
  `jj git fetch` already removed it). Check `jj bookmark list` and
  suggest `jj bookmark delete <name>` for any landed bookmarks that
  remain — local cleanup only; never push the deletion (see below)

## Important

- **Never** pass `--delete-branch` to `gh pr merge`, and **never** push
  bookmark deletions (`jj git push --deleted`). Both delete a base
  branch out from under child PRs. See [recovery.md](../recovery.md) if
  this already happened.
- **Always** verify each child's `baseRefName` is `$TRUNK` before
  merging the next PR. Don't trust auto-retarget — it's a repo setting
  that may not be on.
- Merge **bottom-up**. Top-down is never correct for stacks.
- This subcommand does **not** rewrite the `[<name> N/M]` title markers
  (see [title-convention.md](../title-convention.md)). As PRs land, the
  survivors' labels read stale (`3/4` after the bottom merges) until the
  next `/pr submit` renumbers them — that's intentional, so merging stays
  focused on landing the stack.
- If anything goes wrong, **stop**. `jj op log` shows every operation
  and `jj undo` reverts the last one — that's the local safety net; the
  GitHub-side recovery path is [recovery.md](../recovery.md).
