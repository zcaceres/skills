# `/pr merge` — Land the PR(s)

Merge the stack bottom-up, one PR at a time, with retarget verification
between each step. Uses `git stack merge` when installed; otherwise
walks the stack manually via `gh pr merge` + base retargeting. A branch
with no recorded parent is just a one-branch stack — the same workflow
lands its single PR with no retargeting to do.

**Strategy matters.** Each one has different implications for stacked
PRs:

| Strategy | Flag | SHAs preserved? | Child branches break? | Rebase-onto-main needed? |
|---|---|---|---|---|
| Merge commit | `--merge` (default) | yes | no | no |
| Rebase merge | `--rebase` | no (rewritten) | yes | yes |
| Squash merge | `--squash` | no (single new) | yes | yes |

**Flags (passed through `$ARGUMENTS`):**

- `--merge` (default) — merge commit strategy. Safest for stacks.
- `--rebase` — rebase merge. Triggers the rebase-onto-main dance for
  each child PR.
- `--squash` — squash merge. Same as `--rebase` for stack handling.
- `--all` — keep merging until the stack is empty. Without this,
  merges one PR (the bottom of the stack) and stops.
- `--dry-run` — print the plan without merging anything.

## Workflow

### 1. Pre-flight

```bash
git status --porcelain
```

If anything is uncommitted, stop and tell the user — rebases (for
`--rebase`/`--squash`) and retargets can corrupt or lose work
otherwise.

```bash
git fetch
```

Then map the stack so we know each branch's tip and parent SHA *before*
any rebasing rewrites history:

```bash
CURRENT=$(git branch --show-current)
BRANCH="$CURRENT"
STACK=()
while [[ -n "$BRANCH" ]]; do
  STACK=("$BRANCH" "${STACK[@]}")
  BRANCH=$(git config "branch.$BRANCH.stack-parent" 2>/dev/null)
done
```

`STACK` is ordered bottom (trunk-adjacent) → top.

Record every branch's **pre-rebase tip** (used later for the
rebase-onto-main path — a branch's rebase boundary is its *parent
branch's* recorded tip, never `origin/$B~1`, which silently points
mid-slice when a branch carries more than one commit):

```bash
TIPS=""
for B in "${STACK[@]}"; do
  TIPS+="$B $(git rev-parse "origin/$B")"$'\n'
done
printf '%s' "$TIPS"
```

### 2. Detect `git stack`

```bash
git stack --version 2>/dev/null
```

If this succeeds → **git-stack path** (step 4A).
Otherwise → **fallback path** (step 4B).

### 3. `--dry-run` short-circuit

If the user passed `--dry-run`, print the plan and stop *here*, before any
destructive command in step 4A/4B runs. Do **not** call `gh pr merge`,
`gh pr edit`, `git rebase`, or `git push`. Show:

- The stack (bottom → top) with each branch's PR number and current base
- Which strategy will be used
- For `--rebase`/`--squash`: which branches will be rebased onto main,
  in what order
- The order of `gh pr merge` calls

Stop without changes.

### 4A. git-stack Path (preferred)

`git stack merge` handles bottom-up merging, retarget verification,
and the rebase-onto-main dance for `--rebase`/`--squash` strategies.

```bash
git stack merge "${USER_FLAGS[@]}"
```

Pass through whatever the user supplied (`--merge` / `--rebase` /
`--squash`, `--all`, `--dry-run`). Don't strip or rewrite flags —
`git stack merge` already understands them.

If it errors mid-way, **stop**. Surface the error and ask the user how
to proceed. Partial-merge state is recoverable, but blind retries can
amplify the damage.

When done, switch back to the branch the user was on (if it still
exists locally):

```bash
git checkout "$CURRENT" 2>/dev/null || git checkout main
```

### 4B. Fallback Path (no `git stack`)

Walk the stack bottom-up. For each iteration, work on the
*lowest-remaining* branch in the stack.

#### Detect trunk (once, before the loop)

```bash
if git rev-parse --verify origin/main >/dev/null 2>&1; then
  TRUNK=main
elif git rev-parse --verify origin/master >/dev/null 2>&1; then
  TRUNK=master
else
  echo "Couldn't detect trunk (neither origin/main nor origin/master). Aborting." >&2
  exit 1
fi
```

All retargets and fetches below use `"$TRUNK"`.

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
  if [[ -z "$NEXT_PR" ]]; then
    # Unpublished slice (checkpointed, not yet submitted) — no PR to
    # retarget. Normal under deferred publishing; continue. Never fall
    # through with an empty $NEXT_PR: `gh pr view ""` silently resolves
    # to the *current branch's* PR and would verify (or retarget) the
    # wrong one.
    echo "No open PR for $NEXT — unpublished slice, nothing to retarget"
  else
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
fi
```

`--merge` preserves the bottom PR's SHAs, so child branches already
contain the merged commits and don't need rebasing.

#### Strategy B: `--rebase` or `--squash` (SHA-rewriting)

These rewrite the bottom PR's SHAs as it lands on trunk, so child
branches still have the old SHAs and need their unique commits
rebased onto the new trunk tip *before* merging.

For the **bottom PR**:

```bash
# The bottom PR's base should already be trunk; if it isn't, retarget
# before merging.
if [[ "$PR_BASE" != "$TRUNK" ]]; then
  gh pr edit "$PR_NUMBER" --base "$TRUNK"
fi

gh pr merge "$PR_NUMBER" --rebase   # or --squash
git fetch origin "$TRUNK"
```

Then, for **each remaining branch** in `STACK[1..]` (bottom-up), retarget
+ rebase onto trunk + force-push. The rebase boundary is the **parent
branch's pre-rebase tip** from the `TIPS` map recorded in step 1 — that's
the last commit belonging to the PR below, correct even when a slice
carries several commits:

```bash
PREV="${STACK[0]}"   # the branch below NEXT, walking up
for NEXT in "${STACK[@]:1}"; do
  NEXT_PR=$(gh pr list --head "$NEXT" --state open --json number -q '.[0].number')
  BOUNDARY=$(printf '%s' "$TIPS" | awk -v b="$PREV" '$1 == b { print $2 }')

  # 1. Retarget to trunk — but only if this slice has a PR. An
  #    unpublished slice still needs the rebase below to stay stacked;
  #    `gh pr edit ""` would retarget the *current branch's* PR instead.
  if [[ -n "$NEXT_PR" ]]; then
    gh pr edit "$NEXT_PR" --base "$TRUNK"
  fi

  # 2. Rebase only this PR's unique commits onto the new trunk
  git fetch origin "$TRUNK"
  git rebase --onto "origin/$TRUNK" "$BOUNDARY" "origin/$NEXT"

  # 3. Force-push the rebased branch
  git push --force-with-lease origin "HEAD:refs/heads/$NEXT"

  PREV="$NEXT"
done
```

After all children are rebased onto trunk, continue merging the next
one if `--all` was passed; otherwise stop after merging the bottom PR.

#### After each merge

Refetch trunk and re-derive the stack — branches may have been
deleted, retargeted, or merged.

```bash
git fetch origin "$TRUNK"
STACK=("${STACK[@]:1}")  # drop the bottom that just merged
```

If `--all` was not passed, stop here.
If `STACK` is empty, the stack is fully landed; stop.
Otherwise, loop.

### 5. Report

Print:

- Which PRs merged (URLs)
- Which child PRs were retargeted to trunk
- Which branches were rebased + force-pushed (for `--rebase`/`--squash`)
- A note on which branches can now be deleted locally (`git branch -D
  <branch>` — only after the user confirms they're done with them)

## Important

- **Never** pass `--delete-branch` to `gh pr merge`. Deleting a base
  branch can auto-close child PRs irrecoverably. See
  [recovery.md](../recovery.md) if this already happened.
- **Always** verify each child's `baseRefName` is `$TRUNK` (detected
  in step 4B as `main` or `master`) before merging the next PR. Don't
  trust auto-retarget — it's a repo setting that may not be on.
- Merge **bottom-up**. Top-down is never correct for stacks.
- This subcommand does **not** rewrite the `[<name> N/M]` title markers
  (see [title-convention.md](../title-convention.md)). As PRs land, the
  survivors' labels read stale (`3/4` after the bottom merges) until the
  next `/pr submit` renumbers them — that's intentional, so merging stays
  focused on landing the stack.
- For `--rebase`/`--squash`: keep the original (pre-rebase) branch tips
  (the step-1 `TIPS` map) handy — a branch's `git rebase --onto` boundary
  is its parent branch's recorded tip. Never seed it from
  `origin/$B~1`: that assumes one commit per branch and rebases the
  wrong range otherwise.
- If anything goes wrong, **stop**. The recovery path
  ([recovery.md](../recovery.md)) covers the most common failure mode
  (`--delete-branch` auto-closing a child PR).
