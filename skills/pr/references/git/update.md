# `/pr update` — Commit, Push, and Update the Current PR

Commit only the changes made in this conversation and refresh the current
branch's PR. Use `/pr checkpoint` instead when the work belongs in a new layer.

When the branch belongs to a local `gh stack`, put the change on the lowest
existing layer that owns the concern, restack its descendants, and push through
`gh stack`. Otherwise use ordinary `git push` and `gh pr` for the one-branch
flow.

## Workflow

### 1. Identify and review the current concern

Identify only files changed in this conversation, then inspect:

```bash
git status
git log --oneline -5
git diff HEAD
```

If the diff contains multiple independent concerns, propose an ordered stack
and use `/pr checkpoint` rather than broadening the current PR.

### 2. Choose the owning layer and commit

Inspect `gh stack view`. If the concern belongs to a lower existing layer,
check out that layer before staging. Confirm that the intended working-tree
changes remain after switching, then stage explicit files or hunks and commit:

```bash
gh stack checkout <owning-branch>
git status
git add <file1> <file2> ...
# or: git add -p <file1> <file2> ...
git diff --cached
git commit -m "<type>: <summary>"
```

Never use `git add .` or `git add -A`.

Choose the lowest layer where the change logically belongs. Do not hide a
foundational fix in a higher layer merely to avoid restacking. Prefer a new
review-fix commit over repeatedly amending or squashing a lower commit, because
rewriting a lower commit changes every descendant branch.

### 3. Refresh the PR

First determine whether the current branch is in a tracked local stack:

```bash
gh stack view --short >/dev/null 2>&1
```

If it is, inspect `gh stack view` to determine whether the current layer has
descendants. A lower-layer update must cascade through every layer above it:

```bash
gh stack rebase --upstack
gh stack push
```

If the current branch is already the top layer, do not rebase lower branches:

```bash
gh stack push
```

If the stack contains unpublished layers that also need PRs, run
`gh stack submit` only after the rebase and push. For agent/noninteractive
execution, resolve draft intent from
[SKILL.md](../../SKILL.md#determine-draft-intent):

```bash
gh stack submit --auto          # create new PRs as drafts
gh stack submit --auto --open   # create new PRs ready for review
```

`submit` publishes PRs; it is not a substitute for rebasing descendants after a
lower-layer change. None of these commands rewrite title markers or manually
alter PR bases.

If the branch is not in a local stack, use the standard single-PR flow:

```bash
git push -u origin HEAD
gh pr view --json url 2>/dev/null || \
  gh pr create --base "<base>" --title "<title>" --body "<body>"
```

For a new single PR, use the explicitly supplied base branch; otherwise default
to the repository default branch. Add `--draft` to `gh pr create` when draft
intent is draft. An explicit `--draft`/`--ready` flag may flip an already-open
single PR with `gh pr ready --undo` / `gh pr ready`; the configured default does
not change existing PR state.

### 4. Report

Report the PR URL and whether it is draft or ready. On a stack, run
`gh stack view` and report all affected PRs.

## Important

- Preserve an existing PR's base branch in the one-branch flow.
- Never hand-edit a stacked PR's base; use `gh stack`.
- Never merge trunk into a stack branch or use an unqualified `git pull` there.
- Continue or abort a stopped cascade with `gh stack rebase --continue` or
  `gh stack rebase --abort`, not plain `git rebase`.
- If `gh stack` is unavailable for a branch that should be stacked, stop and
  direct the user to `gh extension install github/gh-stack`.
