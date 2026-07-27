# `/pr sync` — Rebase the Stack onto Updated Trunk

Fetch the trunk (`main` / `master`) and rebase every branch in the
current stack onto the updated tip. Use after the trunk has moved (a
sibling PR merged) and you need the stack to absorb those changes
before continuing.

Uses `git stack sync` when installed, otherwise walks the stack
manually.

**Flags (passed through `$ARGUMENTS`):**

- `--no-push` — rebase locally without force-pushing to origin. Useful
  when you want to inspect or test the rebased stack first.

## Workflow

### 1. Pre-flight: Clean Tree

```bash
git status --porcelain
```

If anything is uncommitted, stop. Tell the user:

> "Uncommitted changes will be lost during rebase. Commit or stash
> them first, then re-run `/pr sync`."

Stop. Don't auto-stash — the user may have changes that belong on
different branches in the stack, and an auto-stash + pop dance can
silently merge them into the wrong place.

### 2. Detect `git stack`

```bash
git stack --version 2>/dev/null
```

If this succeeds → **git-stack path** (step 3A).
Otherwise → **fallback path** (step 3B).

### 3A. git-stack Path

```bash
git stack sync
```

Add `--no-push` if the user passed it. `git stack sync` fetches trunk
and rebases the stack onto the updated tip.

If a rebase conflicts, `git stack sync` will pause. Surface the
conflict to the user along with the `git rebase --continue` /
`--abort` next steps — don't try to auto-resolve.

### 3B. Fallback Path (no `git stack`)

Walk the stack from bottom to top, rebasing each branch onto the
updated tip of the branch below it.

```bash
# Detect trunk (fail loudly if neither main nor master exists)
if git rev-parse --verify origin/main >/dev/null 2>&1; then
  TRUNK=main
elif git rev-parse --verify origin/master >/dev/null 2>&1; then
  TRUNK=master
else
  echo "Couldn't detect trunk (neither origin/main nor origin/master). Aborting." >&2
  exit 1
fi

# Build the stack list bottom-up using stack-parent config
CURRENT=$(git branch --show-current)
BRANCH="$CURRENT"
STACK=()
while [[ -n "$BRANCH" ]]; do
  STACK=("$BRANCH" "${STACK[@]}")
  BRANCH=$(git config "branch.$BRANCH.stack-parent" 2>/dev/null)
done

# Fetch trunk + every stacked branch so --force-with-lease (step 4) has
# fresh remote-tracking refs to compare against — a hours-old origin/<branch>
# would let a concurrent teammate push slip past the lease check.
git fetch origin "$TRUNK" "${STACK[@]}"
```

`STACK` is now ordered bottom (closest to trunk) → top (current
branch).

For each branch in order, rebase it onto the new tip of its parent:

```bash
for i in "${!STACK[@]}"; do
  BRANCH="${STACK[$i]}"
  if (( i == 0 )); then
    PARENT="origin/$TRUNK"
  else
    PARENT="${STACK[$((i-1))]}"
  fi
  git checkout "$BRANCH" || break
  git rebase "$PARENT" || {
    echo "Conflict rebasing $BRANCH onto $PARENT — resolve and re-run /pr sync"
    break
  }
done
```

If a rebase conflicts, stop and tell the user exactly where:

> "Conflict rebasing `<branch>` onto `<parent>`. Resolve, then run
> `git rebase --continue`. After all conflicts are clean, re-run
> `/pr sync` to push the rebased branches."

### 4. Push (unless `--no-push`)

If the user passed `--no-push`, stop here and report which branches
were rebased and what their new tip SHAs are.

Otherwise, force-push each rebased branch with lease protection.
**Per-branch loop, not a bulk push** — `--force-with-lease` needs to
compare each ref against its previously fetched value.

```bash
for BRANCH in "${STACK[@]}"; do
  git push --force-with-lease origin "$BRANCH:refs/heads/$BRANCH" || {
    echo "Push rejected for $BRANCH — someone else may have pushed. Fetch and reconcile."
    break
  }
done
```

Finally, switch back to the branch the user was on:

```bash
git checkout "$CURRENT"
```

### 5. Report

Print, for each branch, the old tip → new tip SHA and whether it was
pushed. End with a one-liner reminding the user that GitHub PRs
auto-pick up the new tip — no manual retargeting needed for `sync`
(unlike `merge --rebase`/`--squash`).

## Important

- Never use plain `git push --force` — always `--force-with-lease`.
- Never auto-resolve rebase conflicts. Surface them and stop.
- If the stack has many branches and the trunk has moved significantly,
  expect cascading conflicts. Tell the user up front so they're not
  surprised.
