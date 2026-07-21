# `/pr update` — Commit, Push, and Update Current PR (jj)

Commit only the changes made in this conversation, push them, and open a
PR if one doesn't exist. **Preserves the existing base branch** on a PR
that's already open.

This is the **jj** path and the **normal-mode default**: bare `/pr` (or
`/pr "a short description"`) runs this — commit, push, open/update a single
PR against the trunk. A description passed with no subcommand seeds the
message / PR title.

> If the uncommitted work is the *next slice* in a stack (not this PR's
> change), use `/pr checkpoint` instead.

**Base branch:** everything after `update` is a single base-branch
argument (default: the trunk bookmark `main`, fallback `master`) — used
only when creating a **new** PR.

**Draft:** resolve draft intent per
[SKILL.md → Determine draft intent](../../SKILL.md). Add `--draft` to
`gh pr create` when **creating** and the answer is draft. When a PR
**already exists**, the configured `pr.draft` default leaves it alone —
only an explicit `--draft`/`-d` or `--ready`/`--no-draft` flips it.

## The staging model

jj auto-tracks the whole working copy into `@`, so — exactly as in
[checkpoint](checkpoint.md) — you name the paths to commit rather than
staging them. `jj commit <paths>` finalizes **only** those paths into a
new change and leaves everything else in `@`.

## Workflow

### 1. Identify Your Changes

Review this conversation for the files YOU modified with Write/Edit. Do
NOT include files changed before this conversation or by other processes.
List them and confirm with the user.

### 2. Check State

```bash
jj status
jj log -r '@ | @-' --no-graph -T 'change_id.short() ++ " " ++ description.first_line() ++ "\n"'
```

Verify your identified files match `jj status`.

### 3. Detect the Trunk Bookmark

```bash
if   [ -n "$(jj bookmark list main   2>/dev/null)" ]; then TRUNK=main
elif [ -n "$(jj bookmark list master 2>/dev/null)" ]; then TRUNK=master
else echo "No trunk bookmark (main/master). Aborting." >&2; exit 1; fi
```

(If a base-branch argument was passed, use it instead of `$TRUNK` for the
PR base.)

### 4. Commit Only Your Changes

Name your files explicitly — never a bare `jj commit`, which would sweep
unrelated working-copy changes into the commit:

```bash
jj commit <file1> <file2> ... -m "$(cat <<'EOF'
<type>: <summary>

<optional body>
EOF
)"
```

This finalizes those paths into a new change at `@-` and moves `@` to a
fresh empty working commit on top. Anything you didn't name stays in `@`.

### 5. Conflict Guard

```bash
if [ -n "$(jj log -r 'conflicts() & @-' --no-graph -T 'change_id.short()')" ]; then
  echo "The committed change is conflicted — resolve before pushing." >&2
  exit 1
fi
```

### 6. Push + Open/Update the PR

Give the committed change a bookmark and push it. `jj git push --change`
does both — it auto-creates a bookmark for the change and pushes it:

```bash
jj git push --change @-        # auto-bookmarks @- and pushes; or bookmark + push explicitly
```

Note the bookmark name it prints (derived from the change ID) — that's the
PR head. Then:

```bash
BR=$(jj log -r @- --no-graph -T 'bookmarks')
PR=$(gh pr list --head "$BR" --state open --json number,url -q '.[0].number')
```

**If a PR exists:** report its URL; do **not** change its base. Only if an
explicit draft flag was passed this run, flip its draft state
(`gh pr ready --undo` to draft, `gh pr ready` to mark ready).

**If no PR exists:** create it against the trunk (add `--draft` when draft
intent is draft):

```bash
gh pr create --base "$TRUNK" --title "<title>" --body "$(cat <<'EOF'
## Summary

- <bullet points>

## Test plan

- <how to verify>
EOF
)"
```

## Important

- NEVER commit files you didn't modify in this conversation. Name paths in
  `jj commit`; never a bare `jj commit` that sweeps the working copy.
- If unsure which files you changed, ASK.
- Report the PR URL when done — note "(draft)" if opened as one.
- When a PR already exists, do not change its base — it may be part of a
  stack. Only an explicit `--draft`/`--ready` flag flips its draft state.
