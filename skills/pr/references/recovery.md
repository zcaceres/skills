# Recovery — Reopen a Child PR Closed by `--delete-branch`

If `gh pr merge --delete-branch` was used on a stacked PR and the child
PR got auto-closed, GitHub won't let you reopen it directly — the base
branch no longer exists. The fix is to recreate the deleted base
branch, reopen the child, retarget it to `main`, then delete the
temporary recreated branch.

This document is referenced from
[`merge.md`](merge.md). It's not exposed as its own subcommand — call
it manually only when the failure has already happened.

## Workflow

### 1. Identify the closed child PR

```bash
gh pr list --state closed --author @me --json number,title,headRefName,baseRefName,state \
  -q '.[] | select(.baseRefName == "<deleted-base-branch>")'
```

Note the PR number and its `headRefName`.

### 2. Recreate the deleted base branch pointing at current main

```bash
git fetch origin main
git push origin "origin/main:refs/heads/<deleted-base-branch>"
```

This temporarily resurrects the branch so GitHub will accept a reopen.

### 3. Reopen the child PR

```bash
gh pr reopen <PR_NUMBER>
```

### 4. Retarget the child PR to main

```bash
gh pr edit <PR_NUMBER> --base main
gh pr view <PR_NUMBER> --json baseRefName -q '.baseRefName'  # verify
```

The verification must print `main` before continuing.

### 5. Delete the temporary recreated branch

```bash
git push origin --delete "<deleted-base-branch>"
```

### 6. Rebase the child branch onto main and force-push

The child's commits still descend from the original (deleted) base, so
they need to be rebased onto main. Use the original parent SHA you
recorded before the merge:

```bash
git fetch origin main
git checkout "<child-branch>"
git rebase --onto origin/main "<original-parent-sha>" "origin/<child-branch>"
git push --force-with-lease origin "HEAD:refs/heads/<child-branch>"
```

If you don't have the original parent SHA, find it from the closed
PR's first commit's parent — `gh pr view <PR_NUMBER> --json commits -q
'.commits[0].oid'` gives you the first commit, and `git rev-parse
<sha>^` gives its parent.

### 7. Verify

The child PR should now:

- Be open
- Have `baseRefName == "main"`
- Have a clean diff against main (no stale parent-branch commits)

```bash
gh pr view <PR_NUMBER> --json state,baseRefName,url -q '.'
```

## Prevention

Don't use `--delete-branch` on stacked PRs. The `/pr merge`
subcommand refuses it for this reason. Branch cleanup is safe *after*
the whole stack has landed and you've confirmed no child PRs depend on
any of the merged branches.
