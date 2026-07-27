# `/pr update` (jj) — Commit, Push, and Update Current PR

Commit only the changes made in this conversation, push them, and open a
PR if one doesn't exist. Stack-aware: commits first, then hands off to
[submit.md](submit.md) for the push/PR half when the working copy sits
on a stack. **Preserves the existing base branch** on PRs that are
already open.

> **This is the single-branch flow.** Bare `/pr` checkpoints a new
> stacked change instead — use `update` when the work belongs on the
> *current* bookmark's PR (amending a slice, follow-up commits, or a
> repo where you're not stacking).

This is the jj-backend variant of [update.md](../git/update.md). The "branch"
is a jj **bookmark**; there is no staging area — explicit paths passed to
`jj commit` are the staging discipline.

**Base branch:** the dispatcher passes everything after `update` as a
single base-branch argument (default: `main`, fallback to `master`) —
only used when creating a **new** PR with no existing base.

> If the uncommitted work represents the *next* slice in a stack (not the
> current bookmark's PR), use `/pr checkpoint` instead — it cuts a new
> stacked change rather than updating the current PR.

**Draft:** resolve draft intent (**draft** or **ready**) per
[SKILL.md → Determine draft intent](../../SKILL.md). When **creating** a
new PR and the answer is draft, add `--draft` to `gh pr create`. When a
PR **already exists**, the configured `pr.draft` default leaves it alone —
only an *explicit* `--draft`/`-d` or `--ready`/`--no-draft` on this
invocation flips it (step 6).

## Workflow

### 1. Identify Your Changes

Review this conversation to identify which files YOU modified using Write
or Edit tools. Do NOT include:

- Files that were already modified before this conversation
- Changes made by other processes or previous sessions

List the files you changed and confirm with the user before proceeding.

### 2. Check Repo State

```bash
jj st
jj log -r 'trunk()..@ | trunk()' --limit 10
```

Verify your identified files match what `jj st` shows in the working
copy.

Then run the push guards. This workflow pushes in step 5, and both
checks must come back clean **before** committing — step 4's
`jj bookmark move` erases the divergence signal, and a recorded
conflict only surfaces as a push error after the bookmark has already
moved:

```bash
# Recorded conflicts — jj never halts on conflicts, so one can sit in
# history after an earlier rebase or sync. Push refuses them.
jj log -r 'trunk()..@ & conflicts()'

# Divergent bookmarks (local and remote positions disagree, rendered
# as name??).
jj bookmark list --conflicted
```

If either prints anything, surface it and stop (`jj resolve` for
conflicts; `jj bookmark move <name> --to <rev>`, with `-B` if
backwards, for divergence).

### 3. Resolve the Branch Bookmark

The current "branch" is the nearest bookmarked ancestor of the working
copy:

```bash
BRANCH=$(jj log -r 'heads(::@ & bookmarks())' --no-graph \
  -T 'local_bookmarks.map(|b| b.name()).join(" ")')
```

- `$BRANCH` empty or equal to the trunk name → there's no feature
  bookmark yet; you'll create one in step 4.
- Otherwise `$BRANCH` is the bookmark whose PR this run updates.

### 4. Commit

Generate a concise commit message based on what you accomplished. Commit
**explicit paths only** — never a bare `jj commit` while unrelated
changes sit in the working copy:

```bash
jj commit -m "$(cat <<'EOF'
<type>: <summary>

<optional body if needed>
EOF
)" <file1> <file2> ...
```

Then put the bookmark on the new commit (`@-`):

- **No feature bookmark yet** (from step 3) — create one, named from the
  commit message (slugified, e.g. `feat/add-user-repository`), and
  reassign `$BRANCH` to it so steps 5–6 push and open the PR against the
  new bookmark, not the trunk:

  ```bash
  jj bookmark create <bookmark-name> -r @-
  BRANCH=<bookmark-name>
  ```

- **Bookmark exists** — advance it. Bookmarks never auto-advance in jj:

  ```bash
  jj bookmark move "$BRANCH" --to @-
  ```

  Always pass `--to` — its default is `@`, the (usually empty)
  working-copy commit.

### 5. Push — Stack-Aware

**Stack check:** if the stack range holds two or more bookmarks —

```bash
jj log -r 'trunk()..@ & bookmarks()' --no-graph \
  -T 'local_bookmarks.map(|b| b.name()).join(" ") ++ "\n"'
```

— the working copy sits on a stack. Step 4 has already folded this
conversation's changes into `$BRANCH` (the top slice); don't push and
update a single PR from here. Follow [submit.md](submit.md) for the
rest (push the whole stack, then renumber) instead of this step and
step 6 — exactly like the git path commits first, then hands off to
`git stack submit`.

**Otherwise** — push the single bookmark:

```bash
jj git push -b "$BRANCH"
```

Push safety is built in — jj updates the remote only if it still matches
what jj last fetched (the `--force-with-lease` equivalent). `-b` also
tracks a brand-new bookmark automatically; if an older jj (≤ 0.41)
refuses to create the new remote branch, add `--allow-new`.

Auto-tracking covers **brand-new** bookmarks only — fetched bookmarks
are never auto-tracked. If `$BRANCH` adopts an existing remote branch
(a local bookmark created on top of a fetched `<name>@origin`, e.g. a
teammate's branch), this push fails with
`Non-tracking remote bookmark <name>@origin exists`. Track the remote
bookmark, then re-run the push:

```bash
jj bookmark track "${BRANCH}@origin"
```

Never push `@` (the working-copy commit) and never use `--change` — push
the named bookmark only.

### 6. Open or Update the PR

Check for an existing PR. The colocated git `HEAD` is detached (jj parks
it at `@-`), so `gh` can never infer the branch — always name it:

```bash
gh pr list --head "$BRANCH" --state open --json number,baseRefName,url -q '.[0]'
```

**If a PR already exists:** report its URL. Do not change the base branch.
If — and only if — the user passed an explicit draft flag this run, flip
the PR's draft state to match (the configured `pr.draft` default never
flips an open PR):

```bash
gh pr ready --undo <number>  # --draft/-d: convert to draft
gh pr ready <number>         # --ready/--no-draft: mark ready for review
```

**If no PR exists**, determine the correct base:

1. If a base-branch argument was provided, use that as the base.
2. Otherwise, check whether the bookmark descends from another feature
   bookmark (i.e. is part of a stack):

   ```bash
   jj log -r "heads(::${BRANCH}- & bookmarks())" --no-graph \
     -T 'local_bookmarks.map(|b| b.name()).join(" ")'
   ```

   If that prints a non-trunk bookmark, ask the user which base to
   target.
3. Default to `main` (fallback `master`).

Create the PR (add `--draft` when draft intent is **draft**):

```bash
gh pr create --head "$BRANCH" --base "<base>" --title "<title>" --body "$(cat <<'EOF'
## Summary

- <bullet points of changes>

## Test plan

- <how to verify>
EOF
)"
```

## Important

- NEVER commit files you didn't modify in this conversation.
- NEVER run a bare `jj commit` with no paths while unrelated changes are
  in the working copy — pass explicit files.
- If unsure which files you changed, ASK the user.
- Never push with the step 2 guards unresolved — a recorded conflict
  fails only at push time, and step 4's bookmark move erases the
  divergence (`name??`) signal.
- Report the PR URL when done — note "(draft)" if it was opened as one.
- When a PR already exists, do not change its base branch — it may be
  part of a stack. Only an explicit `--draft`/`--ready` flag flips its
  draft state.
- Always pass `--head "$BRANCH"` to `gh pr create` — detached `HEAD` in a
  colocated repo is normal, not breakage, but it means `gh` can't guess
  the branch.
