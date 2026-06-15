# `/pr checkpoint` — Ship Current Slice as a Stacked PR

Commit the current uncommitted work as the next branch in a stack, push
it, and open a PR against the parent branch. Leave the user on the new
child branch, ready to keep working.

Uses `git stack` when available, otherwise falls back to `gh` CLI + `git`.

**Slice description:** the dispatcher passes either the explicit text
after the `checkpoint` keyword, or — when invoked without a keyword —
the full `$ARGUMENTS`. Used as both the commit message and the source
for the auto-derived branch name. If empty, infer from the diff.

## Workflow

### 1. Identify Your Changes

Review this conversation to identify which files YOU modified using Write
or Edit tools. Do NOT include:

- Files that were already modified before this conversation
- Changes made by other processes or previous sessions

List the files you changed and confirm with the user before proceeding.

### 2. Review the Diff

```bash
git status
git diff --stat HEAD
```

Show the user the stat. Do **NOT** adjudicate coherence yourself. Only
pause to ask the user about slicing if the diff touches **more than 6
distinct top-level directories** — that's a cheap signal that multiple
concerns are mixed.

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

If the slice description is empty, generate a concise
conventional-commit-style message from the diff (e.g. `feat: add user
repository`, `fix: handle null token in middleware`).

```bash
git stack create -m "<commit message>"
```

This creates a new branch (auto-slugified from the message), records the
parent relationship, and commits staged changes.

Then submit the stack:

```bash
git stack submit
```

This pushes (force-with-lease) and creates/updates one GitHub PR per
branch in the stack, with the correct base branches.

### 6B. `gh` Fallback Path — Create Branch + PR

Record the current branch as the parent:

```bash
PARENT_BRANCH=$(git branch --show-current)
```

Generate a branch name from the commit message or the slice description
(slugified, e.g. `feat/add-user-repository`). Create and switch to the
new branch:

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
- A reminder: "You're on the child branch now. Keep working — the next
  `/pr` (or `/pr checkpoint`) will stack on top."

## Important

- NEVER commit files you didn't modify in this conversation.
- NEVER use `git add .` or stage unrelated changes.
- **`gh` path:** Always set `--base` to the parent branch, not `main`,
  to preserve the stack chain.
- Report the PR URL when done.

## Merging the Stack

When ready to land, use [`/pr merge`](merge.md) — it merges the stack
bottom-up, never uses `--delete-branch`, and verifies each child's
`baseRefName` is the trunk before merging the next.
