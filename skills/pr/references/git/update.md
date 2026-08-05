# `/pr update` — Commit, Push, and Update the Current PR

Commit only the changes made in this conversation and refresh the current
branch's PR. Use `/pr checkpoint` instead when the work belongs in a new layer.

When the branch belongs to a local `gh stack`, update and submit the whole stack
so GitHub keeps its native stack relationship intact. Otherwise use ordinary
`git push` and `gh pr` for the one-branch flow.

## Workflow

### 1. Identify, review, and stage the current concern

Identify only files changed in this conversation, then inspect:

```bash
git status
git log --oneline -5
git diff HEAD
```

If the diff contains multiple independent concerns, propose an ordered stack
and use `/pr checkpoint` rather than broadening the current PR. Stage explicit
files or hunks only:

```bash
git add <file1> <file2> ...
# or: git add -p <file1> <file2> ...
git diff --cached
```

Never use `git add .` or `git add -A`.

### 2. Commit

```bash
git commit -m "<type>: <summary>"
```

### 3. Refresh the PR

First determine whether the current branch is in a tracked local stack:

```bash
gh stack view --short >/dev/null 2>&1
```

If it is, submit the stack. For agent/noninteractive execution, resolve draft
intent from [SKILL.md](../../SKILL.md#determine-draft-intent): `--auto` creates
new PRs as drafts, while `--auto --open` creates them ready for review.

```bash
gh stack submit --auto          # draft intent
gh stack submit --auto --open   # ready intent
```

This does not rewrite title markers or manually alter PR bases.

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
- If `gh stack` is unavailable for a branch that should be stacked, stop and
  direct the user to `gh extension install github/gh-stack`.
