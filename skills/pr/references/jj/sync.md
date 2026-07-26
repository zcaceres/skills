# `/pr sync` (jj) — Rebase the Stack onto Updated Trunk

Fetch the trunk (`main` / `master`) and rebase the whole stack onto the
updated tip. Use after the trunk has moved (a sibling PR merged) and you
need the stack to absorb those changes before continuing.

This is the jj-backend variant of [sync.md](../sync.md), and it's where
jj collapses the most work: one `jj rebase` moves the entire stack, every
bookmark follows its rewritten commit automatically, and there is no
per-branch checkout/rebase/push loop.

**Flags (passed through `$ARGUMENTS`):**

- `--no-push` — rebase locally without pushing to origin. Useful when
  you want to inspect or test the rebased stack first.

## Workflow

### 1. Pre-flight

There is no dirty-tree stop: the working copy is itself a commit and
rides the rebase safely. The guards that remain:

```bash
# Pre-existing conflicted commits — resolve before piling a rebase on top.
jj log -r 'trunk()..@ & conflicts()'

# Divergent bookmarks (rendered name??) — resolve before rewriting.
jj bookmark list --conflicted
```

If either prints anything, surface it and stop (`jj resolve` for
conflicts; `jj bookmark move <name> --to <rev>`, with `-B` if backwards,
for divergence).

### 2. Fetch + Restack

```bash
jj git fetch
jj rebase -d 'trunk()' --skip-emptied
```

`jj rebase` defaults to `-b @` — the entire stack moves in one command,
and every bookmark follows its rewritten commit. No checkout loop, no
per-branch rebase, no SHA bookkeeping.

`--skip-emptied` abandons commits whose changes already landed in trunk
(e.g. a slice whose PR merged). The landed slice's bookmark does **not**
vanish with it — jj retains the bookmark and moves it to the abandoned
commit's parent, which for a landed bottom slice is the new trunk tip
(verified on jj 0.43). Left in place, the stale bookmark corrupts later
bookmark lookups — the `$BRANCH` idiom `heads(::@ & bookmarks())` joins
every bookmark name on the commit it resolves to, yielding a
space-joined non-branch. Find and delete any landed-slice bookmark
**locally**:

```bash
# Landed bookmarks sit on the trunk tip now (ignore the trunk's own name):
jj bookmark list -r 'trunk()'
jj bookmark delete <landed-name>   # local cleanup only
```

**Never push the deletion** — no `jj git push --deleted`, no
`-b <landed-name>`. That would delete the **remote** branch, which is
`--delete-branch` in disguise and can auto-close child PRs (see
[recovery.md](../recovery.md)). The step-4 push (`-r 'trunk()..@'`)
excludes the trunk tip, so the stale bookmark is never pushed by
accident.

### 3. Conflict Check

jj rebases never halt — conflicts are recorded as markers inside the
affected commits instead:

```bash
jj log -r 'trunk()..@ & conflicts()'
```

If this prints anything, report exactly which changes conflict, point
the user at `jj st` on the conflicted change and `jj resolve`, and stop
**before pushing** (push refuses conflicted commits anyway). Never
auto-resolve.

### 4. Push (unless `--no-push`)

If the user passed `--no-push`, stop here; report the new stack
(`jj log -r 'trunk()..@'`) and suggest
`jj git push -r 'trunk()..@' --dry-run` as the preview.

Otherwise:

```bash
jj git push -r 'trunk()..@'
```

This pushes every already-published stack bookmark that moved, with
jj's built-in force-with-lease-style safety (the remote is updated only
if it still matches what jj last fetched — the fetch in step 2
refreshed that).

A bookmark that has **never been pushed** — a slice checkpointed but
not yet submitted — is skipped by design: jj warns
`Refusing to create new remote bookmark <name>@origin`, still pushes
the rest, and exits 0. That's the correct outcome (checkpoints stay
local until `/pr submit`), so report the skip; don't treat the warning
as a failure, and don't "fix" it with `-b <name>` or `--allow-new` —
either would eagerly publish the unsubmitted slice.

### 5. Report

Show the restacked tree:

```bash
jj log -r 'trunk()..@ | trunk()'
```

Change IDs are stable across rebases, so there's no old-tip → new-tip
SHA table to maintain — the tree is the report. Note any landed-slice
bookmarks `--skip-emptied` moved to the trunk tip and confirm they were
deleted locally (step 2). End with a one-liner reminding the user that
GitHub PRs auto-pick up the new tips — no manual retargeting needed for
`sync` (unlike `merge --rebase`/`--squash`).

## Important

- Never auto-resolve conflicts. Surface them and stop.
- Never push conflicted commits — gate on step 3 first.
- If the trunk has moved significantly, expect conflicts across several
  changes at once (jj records them all in one pass rather than stopping
  at the first). Tell the user up front so they're not surprised.
