# `/pr submit` (jj) — Publish the Whole Stack

**This is the publish point for a stack.** Checkpoints are built locally
and unpublished (see [`/pr checkpoint`](checkpoint.md)); `submit` is what
pushes every bookmark, opens one GitHub PR per bookmark (each targeting
the bookmark below it), and stamps the `[<name> N/M]` title markers — so
the finished stack reaches GitHub as one coherent set rather than a
trickle of partial PRs. Idempotent — safe to re-run after rebases or
after adding more checkpoints.

This is the jj-backend variant of [submit.md](../git/submit.md). It needs no
extra tool: jj pushes the stack natively (with built-in
force-with-lease-style safety), and the PR loop is plain `gh`.

## Flags (passed through `$ARGUMENTS`)

- `--draft` — open the stack's PRs as **drafts**. Every PR this run
  *creates* gets `--draft` on its `gh pr create`. Existing PRs are left
  as-is (`--draft` only affects newly-created PRs; it will not convert an
  already-open PR back to draft). This is also implied when
  `git config pr.draft true` is configured (see
  [SKILL.md → Determine draft intent](../../SKILL.md#determine-draft-intent)),
  unless overridden by `--ready`/`--no-draft` on the invocation.

## Workflow

### 1. Verify You're In a Stack

Derive the stack — every bookmarked change between trunk and the working
copy, bottom to top:

```bash
STACK=($(jj log -r 'trunk()..@ & bookmarks()' --no-graph --reversed \
  -T 'local_bookmarks.map(|b| b.name()).join(" ") ++ "\n"'))
```

If `STACK` is empty, there's nothing to push as a group. Tell the user:

> "The working copy isn't sitting on a stack — there's nothing for
> `/pr submit` to push as a group. Use `/pr update` for a single-branch
> push, or `/pr checkpoint` to start a stack."

Stop here.

### 2. Guards

All five must come back clean before anything is pushed:

```bash
# Conflicted commits in the stack — jj records conflicts instead of
# halting, so they can sit in history. Push refuses them; catch it here.
jj log -r 'trunk()..@ & conflicts()'

# Divergent bookmarks (local and remote positions disagree, rendered
# as name??).
jj bookmark list --conflicted

# Non-empty commits with no description — jj git push refuses these.
jj log -r 'trunk()..@ ~ empty() & description("")'

# Committed slices with no bookmark — a hand jj split / jj new left a
# change that can't become a PR and would silently fold into the next
# bookmark's diff.
jj log -r 'trunk()..@- ~ bookmarks() ~ empty()'

# Non-empty work in the working copy itself — in-progress changes that
# won't be published.
jj log -r '@ ~ empty()'
```

If the first three print anything, surface it and stop (`jj resolve` for
conflicts; `jj bookmark move <name> --to <rev>` for divergence — with
`-B` if the move is backwards; `jj describe` for missing messages).

For each **bookmark-less committed slice** (fourth guard), create a
bookmark so it publishes as its own PR — slug from its description, same
convention as [checkpoint](checkpoint.md):

```bash
jj bookmark create <slug> -r <change-id>
```

If you can't infer a good name from the description, ask the user.
Then re-derive `STACK` (step 1) so the new bookmark takes its place. If
the user instead wants the change folded into the slice above it, that's
a `jj squash --into <bookmark>` — confirm before rewriting.

If the **working copy** (fifth guard) is non-empty, warn: that work won't
be published — the user likely forgot a `/pr checkpoint`. Ask before
continuing without it.

### 3. Pre-flight: Fetch + Show the Stack

```bash
jj git fetch
jj bookmark list --conflicted
jj log -r 'trunk()..@ | trunk()'
```

A teammate's push to a stack branch shows up after the fetch as a
conflicted (`name??`) bookmark — that's the drift signal (the jj
equivalent of a failed `--force-with-lease`). If any bookmark is
conflicted, pause and ask how to reconcile before overwriting their
work. Show the user the stack tree.

### 4. Push the Whole Stack

Push by explicit bookmark name — one `-b` per stack member. Never push
`@` (the working-copy commit) and never use `--change`:

```bash
jj git push --dry-run -b <bottom> -b <mid> -b <top>   # preview remote changes
jj git push -b <bottom> -b <mid> -b <top>
```

Show the user the dry-run preview before the real push. `-b` tracks
brand-new bookmarks automatically; if an older jj (≤ 0.41) refuses to
create a new remote branch, add `--allow-new`. Push safety is built in —
jj updates each remote branch only if it still matches what jj last
fetched.

Auto-tracking covers **brand-new** bookmarks only — fetched bookmarks
are never auto-tracked. If any slice adopts an existing remote branch
(a local bookmark created on top of a fetched `<name>@origin`, e.g. a
teammate's branch), the push — and the dry-run — fail with
`Non-tracking remote bookmark <name>@origin exists`. Track that
bookmark, then re-run:

```bash
jj bookmark track "<name>@origin"
```

### 5. Open PRs Bottom-Up

Resolve draft intent (**draft** or **ready**) per
[SKILL.md → Determine draft intent](../../SKILL.md#determine-draft-intent).

For each bookmark in `STACK` order, check for an open PR (batch these
lookups in parallel — one per bookmark):

```bash
gh pr list --head "$B" --state open --json number,baseRefName,url -q '.[0]'
```

For any bookmark without one, create it — base is the previous `STACK`
entry (the trunk name for the bottom), and `--head` is always explicit
(colocated git `HEAD` is detached, so `gh` can't infer the branch). Add
`--draft` when draft intent is **draft**:

```bash
gh pr create --head "$B" --base "$PREV" --title "<title>" --body "$(cat <<'EOF'
## Summary

- <bullet points>

## Test plan

- <how to verify>

---
Stack: this PR targets `<PREV>`, not `main`. Merge bottom-up.
EOF
)"
```

For any bookmark that **already has** an open PR, verify its base
matches the stack's current shape and retarget when it doesn't — a
reordered or re-parented stack self-heals on re-submit, same as
`git stack submit` does on the git path:

```bash
if [[ "$PR_BASE" != "$PREV" ]]; then
  gh pr edit "$PR_NUMBER" --base "$PREV"
  # Re-read to confirm before touching the next PR
  gh pr view "$PR_NUMBER" --json baseRefName -q '.baseRefName'   # must print $PREV
fi
```

Record every retarget performed — the report (step 7) lists them, so a
base never moves silently under a reviewer. Draft state of existing PRs
is never touched here.

### 6. Renumber Stack Title Markers

Run the renumber routine from
[references/title-convention.md](../title-convention.md) so every PR's
title carries its `[<name> N/M]` marker. Use that file's **jj backend**
note for deriving the stack (ancestry, not `stack-parent` config); the
rest of the routine is plain `gh` and runs unchanged.

### 7. Report

Print one line per PR with the title (marker included), URL, and base.
If step 5 retargeted any existing PR, list each one explicitly
(`#43 base: main → feat/layer-1`) — reviewers need to know a diff
changed shape. E.g.:

```
#42  [auth 1/3] Add token model        base: main          (bottom)  https://github.com/…/pull/42
#43  [auth 2/3] Add token middleware    base: feat/layer-1            https://github.com/…/pull/43
#44  [auth 3/3] Wire into the router    base: feat/layer-2  (top)     https://github.com/…/pull/44
```

Recover URLs via `gh pr view <number> --json url,baseRefName -q '...'`.

## Important

- Never run with `--no-verify` or similar — let pre-push hooks fire.
- If a `gh pr create` fails mid-loop, stop and surface the error. Don't
  retry blindly — partial state is recoverable, blind retries can
  amplify mistakes.
- Don't rewrite or amend commits inside this subcommand. Use
  `/pr update` or `/pr sync` for those workflows.
- Named bookmarks only — never `jj git push --change` (auto-generated
  `push-*` branch names make unreadable PR bases).
