# `/stacked-pr update` — Commit, Push, and Update Current PR

Commit only the changes made in this conversation, push them, and open a
PR if one doesn't exist. Stack-aware: uses `git stack submit` when on a
stacked branch, otherwise uses `gh` directly. **Preserves the existing
base branch** on PRs that are already open.

**Base branch:** the dispatcher passes everything after `update` as a
single base-branch argument (default: `main`, fallback to `master`) —
only used in the plain `gh` path when creating a **new** PR with no
existing base.

> If the uncommitted work represents the *next* slice in a stack (not the
> current branch's PR), use `/stacked-pr checkpoint` instead — it creates
> a new stacked branch rather than updating the current PR.

## Workflow

### 1. Identify Your Changes

Review this conversation to identify which files YOU modified using Write
or Edit tools. Do NOT include:

- Files that were already modified before this conversation
- Changes made by other processes or previous sessions

List the files you changed and confirm with the user before proceeding.

### 2. Check Git State

```bash
git status
git log --oneline -5
```

Verify your identified files match what's shown in git status.

### 3. Stage Only Your Changes

Stage ONLY the files you modified in this conversation:

```bash
git add <file1> <file2> ...
```

Do NOT use `git add .` or `git add -A` — be explicit about each file.

### 4. Commit

Generate a concise commit message based on what you accomplished. Use
HEREDOC format:

```bash
git commit -m "$(cat <<'EOF'
<type>: <summary>

<optional body if needed>
EOF
)"
```

### 5. Push and Open PR — Stack-Aware

Decide which path to take:

```bash
git stack --version 2>/dev/null && git config "branch.$(git branch --show-current).stack-parent" 2>/dev/null
```

**If both succeed (git-stack installed AND current branch is stacked):**

```bash
git stack submit
```

This pushes all branches in the stack (force-with-lease) and
creates/updates a GitHub PR for each branch with the correct base.
Idempotent.

**Otherwise → plain `gh` + `git` path:**

```bash
git push -u origin HEAD
```

Then check for an existing PR:

```bash
gh pr list --head "$(git branch --show-current)" --state open --json number,baseRefName,url -q '.[0]'
```

**If a PR already exists:** report its URL. Do not change the base branch.

**If no PR exists**, determine the correct base:

1. If a base-branch argument was provided, use that as the base.
2. Otherwise, check if this branch was created off another non-main
   branch (i.e. part of a stack):

   ```bash
   git log --oneline --decorate main..HEAD
   ```

   If the branch clearly descends from another feature branch, ask the
   user which base to target.
3. Default to `main` (fallback `master`).

Create the PR:

```bash
gh pr create --base "<base>" --title "<title>" --body "$(cat <<'EOF'
## Summary

- <bullet points of changes>

## Test plan

- <how to verify>
EOF
)"
```

## Important

- NEVER commit files you didn't modify in this conversation.
- NEVER use `git add .` or stage unrelated changes.
- If unsure which files you changed, ASK the user.
- Report the PR URL when done.
- **`gh` path:** When a PR already exists, do not change its base
  branch — it may be part of a stack.
