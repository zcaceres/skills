# `/pr checkpoint` — Cut the Current Slice as the Next Stacked Branch

Commit the current uncommitted work as the next branch in a stack and
leave the user on the new child branch, ready to keep working.

**Publishing is deferred.** On the `git stack` path this is a purely
**local** operation — it does **not** push or open a PR. You build the
whole stack locally with repeated checkpoints, then publish it as one
finished set with [`/pr submit`](submit.md). This keeps half-built,
partial PRs from accumulating on GitHub and confusing reviewers.

Uses `git stack` when available, otherwise falls back to `gh` CLI + `git`.

> **`gh`-fallback caveat (temporary):** without `git stack`, this path
> still pushes and opens the PR immediately — deferred publishing isn't
> wired into the `gh`-only path yet. If you want the deferred workflow,
> use `git stack`.

**Slice description:** the dispatcher passes either the explicit text
after the `checkpoint` keyword, or — when invoked without a keyword —
the full `$ARGUMENTS`. Used as both the commit message and the source
for the auto-derived branch name. If empty, infer from the diff.

**Draft:** resolve draft intent (**draft** or **ready**) per
[SKILL.md → Determine draft intent](../SKILL.md). The `gh` fallback path
publishes eagerly, so it opens the PR with `--draft` when the answer is
draft. The `git stack` path doesn't publish here at all — drafts are
applied when you publish the stack with [`/pr submit`](submit.md) (see its
"Drafting (the git-stack path)" step).

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

### 6A. git-stack Path — Create Branch (local, no publish)

If the slice description is empty, generate a concise
conventional-commit-style message from the diff (e.g. `feat: add user
repository`, `fix: handle null token in middleware`).

```bash
git stack create -m "<commit message>"
```

This creates a new branch (auto-slugified from the message), records the
parent relationship, and commits staged changes — **all local**.

**Do not** run `git stack submit` here. Publishing is deferred to
[`/pr submit`](submit.md): the stack reaches GitHub (all branches pushed,
all PRs opened, titles marked) only once, when you're done building it.
Skip ahead to step 7.

### 6B. `gh` Fallback Path — Create Branch + PR (eager publish)

> This path still publishes immediately — see the caveat at the top of
> this file. Deferred publishing is `git stack`-only for now.

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

Push and create a PR targeting the parent branch (not main). Add
`--draft` when draft intent is **draft**:

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

### 6C. Renumber Stack Title Markers (`gh`-fallback path only)

The `gh`-fallback path (6B) just published a PR, so run the renumber
routine from [references/title-convention.md](title-convention.md) to give
every PR in the stack an up-to-date `[<name> N/M]` marker — adding this
checkpoint grew `M`, so the siblings' titles need rewriting too.

Skip this on the git-stack path (6A) — nothing is published yet, so
there's nothing to mark. Markers are applied when you
[`/pr submit`](submit.md).

### 7. Report

**git-stack path (local):**

- The new branch name (`git branch --show-current`).
- "Sliced locally — nothing pushed. Keep working; the next `/pr` (or
  `/pr checkpoint`) stacks on top. Run `/pr submit` to publish the whole
  stack when it's ready."

**`gh`-fallback path (published):**

- The new PR URL (`gh pr view --json url --jq .url`).
- The new branch name (`git branch --show-current`).
- The PR's marked title (`[<name> N/M] …`) so the user sees its place in
  the stack.
- A reminder: "You're on the child branch now. Keep working — the next
  `/pr` (or `/pr checkpoint`) will stack on top."

## Important

- NEVER commit files you didn't modify in this conversation.
- NEVER use `git add .` or stage unrelated changes.
- **git-stack path:** local only — never `git stack submit` here.
  Publishing happens at [`/pr submit`](submit.md).
- **`gh` path:** Always set `--base` to the parent branch, not `main`,
  to preserve the stack chain. Report the PR URL when done.

## Publishing and Merging the Stack

When the stack is built, publish it all at once with
[`/pr submit`](submit.md) (git-stack path). Then, when ready to land, use
[`/pr merge`](merge.md) — it merges the stack bottom-up, never uses
`--delete-branch`, and verifies each child's `baseRefName` is the trunk
before merging the next.
