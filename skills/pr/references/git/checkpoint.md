# `/pr checkpoint` — Cut the Current Slice as the Next Stacked Branch

Commit the current uncommitted work as a focused layer in a local `gh stack`.
Checkpoints do **not** push or open pull requests; build every layer locally,
then publish the complete stack with [`/pr submit`](submit.md).

The Git backend requires GitHub's first-party extension:

```bash
gh extension install github/gh-stack
```

**Slice description:** the dispatcher passes either the explicit text after
`checkpoint`, or (for bare `/pr`) the full `$ARGUMENTS`. Use it as a concise
commit message and branch-name seed. If it is empty, infer it from the diff.

## Workflow

### 1. Identify and slice the changes

Review this conversation to identify only files changed in this conversation.
Inspect the working tree and diff:

```bash
git status
git diff --stat HEAD
git diff HEAD
```

Apply the shared concern-slicing and stack-ordering policy in
[SKILL.md](../../SKILL.md#important--applies-to-every-subcommand). If it yields
multiple slices, get confirmation on the bottom-to-top plan before staging.

### 2. Verify `gh stack` and stage the slice

```bash
gh stack --help >/dev/null || {
  echo 'Install the official extension: gh extension install github/gh-stack' >&2
  exit 1
}
git add <file1> <file2> ...
# Or, when concerns share a file:
git add -p <file1> <file2> ...
git diff --cached
```

Never use `git add .` or `git add -A`.

### 3. Create the layer

If the current branch is already the top of a tracked stack, commit the staged
slice onto that branch and create a new empty child branch:

```bash
gh stack add -m "<commit message>" <next-branch-name>
```

`gh stack add -m` commits the staged slice on the current top branch, then
checks out the new child. Choose a short descriptive `<next-branch-name>`.

If there is no local stack yet, initialize one first, then commit the staged
slice on its first branch. Enable Git's conflict-resolution reuse beforehand so
`gh stack init` does not block an agent on its interactive `rerere` prompt:

```bash
git config rerere.enabled true
gh stack init <first-branch-name>
git commit -m "<commit message>"
```

Do not push or run `gh stack submit` here. If another confirmed slice remains,
repeat staging and this step from the new top branch.

### 4. Report

Report the branch now checked out and say that the stack remains local. Direct
the user to `/pr submit` when the set of layers is ready for review.

## Important

- Never commit files that were not modified in this conversation.
- Never stage unrelated changes or use `git add .` / `git add -A`.
- Do not create PRs during a checkpoint. Draft intent applies at `/pr submit`.
