---
name: checkpoint
description: Ship uncommitted work as the next branch in a stack, push it, and open a PR against the parent branch. Uses git stack if installed, else gh + git. Invoke via /checkpoint.
argument-hint: "[slice description]"
disable-model-invocation: true
---

# Checkpoint — Ship Current Slice as a Stacked PR

> **Deprecated — use [`/stacked-pr checkpoint`](../stacked-pr/) instead.**
> This skill has been folded into the consolidated `stacked-pr` skill,
> which bundles the full stacked-PR workflow (checkpoint, update,
> submit, log, sync, merge) and the PostToolUse nudge hook as one
> install. The body of this skill is preserved verbatim for the
> deprecation window and will be removed after one release cycle.

Commit the current uncommitted work as the next branch in a stack, push it, and open a PR against the parent branch. Leave the user on the new child branch, ready to keep working.

Uses `git stack` when available, otherwise falls back to `gh` CLI + `git`.

**Usage:** `/checkpoint [slice description]`

**Slice description:** $ARGUMENTS — used as both the commit message and the source for the auto-derived branch name. If empty, infer from the diff.

## Workflow

### 1. Identify Your Changes

Review this conversation to identify which files YOU modified using Write or Edit tools. Do NOT include:
- Files that were already modified before this conversation
- Changes made by other processes or previous sessions

List the files you changed and confirm with the user before proceeding.

### 2. Review the Diff

```bash
git status
git diff --stat HEAD
```

Show the user the stat. Do **NOT** adjudicate coherence yourself. Only pause to ask the user about slicing if the diff touches **more than 6 distinct top-level directories** — that's a cheap signal that multiple concerns are mixed.

### 3. Detect Stack Tooling

```bash
git stack --version 2>/dev/null
```

If this succeeds → **git-stack path** (step 6A).
Otherwise → **`gh` fallback path** (step 6B).

### 4. Pre-flight: Check for Remote Drift

```bash
git fetch
```

If anyone else may have pushed to the current branch, resolve first.

### 5. Stage Only Your Changes

Stage explicitly — never `git add .` / `git add -A`:

```bash
git add <file1> <file2> ...
```

### 6A. git-stack Path — Create Branch + Submit

If `$ARGUMENTS` is empty, generate a concise conventional-commit-style message from the diff (e.g. `feat: add user repository`, `fix: handle null token in middleware`).

```bash
git stack create -m "<commit message>"
```

This creates a new branch (auto-slugified from the message), records the parent relationship, and commits staged changes.

Then submit the stack:

```bash
git stack submit
```

This pushes (force-with-lease) and creates/updates one GitHub PR per branch in the stack, with the correct base branches.

### 6B. `gh` Fallback Path — Create Branch + PR

Record the current branch as the parent:

```bash
PARENT_BRANCH=$(git branch --show-current)
```

Generate a branch name from the commit message or `$ARGUMENTS` (slugified, e.g. `feat/add-user-repository`). Create and switch to the new branch:

```bash
git checkout -b <new-branch-name>
```

Commit:

```bash
git commit -m "$(cat <<'EOF'
<commit message>
EOF
)"
```

Push and create a PR targeting the parent branch (not main):

```bash
git push -u origin HEAD
gh pr create --base "$PARENT_BRANCH" --title "<title>" --body "$(cat <<'EOF'
## Summary

- <bullet points>

## Test plan

- <how to verify>

---
Stack: this PR targets `<PARENT_BRANCH>`, not `main`. Merge bottom-up.
EOF
)"
```

### 7. Report

Report:
- The new PR URL (`gh pr view --json url --jq .url`).
- The new branch name (`git branch --show-current`).
- A reminder: "You're on the child branch now. Keep working — the next `/checkpoint` will stack on top."

## Important

- NEVER commit files you didn't modify in this conversation.
- NEVER use `git add .` or stage unrelated changes.
- **`gh` path:** Always set `--base` to the parent branch, not `main`, to preserve the stack chain.
- Report the PR URL when done.

## Merging a Stack (gh path)

See the full merge guide in the **Stacked PRs** CLAUDE.md section. Summary of the three strategies:

- **`--merge` (recommended):** Preserves SHAs. Child branches just work.
- **`--rebase`:** Rewrites SHAs. Must rebase each child onto main before merging.
- **`--squash`:** Same problems as rebase. Avoid for stacks.

**Key rules:**
- Merge bottom-up, one PR at a time.
- **Never use `--delete-branch`** — GitHub's auto-retarget is a repo setting, not guaranteed. Deleting a base branch can auto-close child PRs irrecoverably.
- Verify each child's `baseRefName` is `main` before merging the next.
- With `--rebase`/`--squash`: retarget to main → `git rebase --onto origin/main <parent-commit> origin/<branch>` → force-push → merge.
