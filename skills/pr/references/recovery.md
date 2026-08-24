# Recovery — Restore Stack State Safely

Use this document only after a non-stack-aware operation has already damaged a
stack—for example, an individual merge deleted a base branch and auto-closed a
child PR. Normal merges and partial merges must stay within `gh stack`.

## Normal post-merge synchronization

After the entire stack lands:

```bash
gh stack sync --prune
gh stack view
```

After a partial stack merge, GitHub rebases and retargets the remaining PRs:

```bash
gh stack sync
gh stack view
```

Do not recreate deleted branches, manually retarget PRs, or independently rebase
the remaining branches onto trunk.

## Interrupted cascade rebase

Inspect the conflict, resolve it, and stage only the resolved files:

```bash
git status
git add <resolved-files>
gh stack rebase --continue
```

To restore the stack to its pre-rebase state:

```bash
gh stack rebase --abort
```

Continue and abort through `gh stack`, not plain `git rebase`, so the extension
can manage the complete cascading operation.

## Legacy damage from non-stack-aware commands

If `gh stack sync` cannot recover because a base branch was deleted or a child
PR was closed, stop and report:

- `gh stack view`
- `git status`
- the affected PR URLs and their head/base branches
- the non-stack-aware command that caused the damage, if known

Do not perform manual remote surgery automatically. Recreating branches,
retargeting PRs, and force-pushing can discard teammate work or corrupt the
remaining stack; require an explicit, repository-specific recovery plan and
user confirmation.

## Prevention

- Merge with `gh stack merge`, never `gh pr merge`.
- Do not use `--delete-branch` while descendants still depend on a branch.
- Synchronize with `gh stack sync`, not `git pull` or per-branch trunk rebases.
- Push rewritten stacks with `gh stack push`, never `git push --force`.
