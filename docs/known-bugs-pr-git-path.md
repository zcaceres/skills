# Known bugs — `pr` skill git path & `git-stack`

Surfaced while adding the jj VCS path to the `pr` skill (two survey passes
over `skills/pr/` and `~/git-stack`). **None are fixed** — captured here so
they can be triaged and fixed separately. The jj path added alongside does
not inherit any of them.

Grouped by where the fix lands: bugs 1–2 are in this repo (`skills/pr/`);
bugs 3–8 are in the separate `git-stack` repo (`~/git-stack`, published
from `zcaceres/git-stack`).

## In this repo — `skills/pr/references/git/`

### 1. gh-fallback `checkpoint` never records the stack parent

`references/git/checkpoint.md` (path 6B, the `gh`-only fallback) captures
`PARENT_BRANCH=$(git branch --show-current)` into a shell variable and uses
it for `gh pr create --base`, but never runs
`git config "branch.<new>.stack-parent" "$PARENT_BRANCH"`.

Every consumer of that key — `references/git/log.md`, `sync.md`, `merge.md`,
`title-convention.md` — walks the `stack-parent` chain, finds nothing, and
reports a **one-element stack**. The key is only ever written by the
`git stack` binary, so the documented `gh`-only stacked path is effectively
broken: submit/sync/merge/log all see a stack of one.

**Fix sketch:** in the 6B path, after creating the branch, write
`git config "branch.<new>.stack-parent" "$PARENT_BRANCH"` (and
`gh-merge-base` to match, mirroring what `git stack create` does).

### 2. One-commit-per-branch is assumed but never stated

`references/git/merge.md` and `log.md` read
`git rev-parse --short "origin/$B~1"` to seed `git rebase --onto`. That is
only correct if each branch is exactly **one commit** ahead of its parent.
It's undocumented and silently wrong for a multi-commit slice — `~1` points
mid-slice, so the `--onto` rebase replays the wrong range.

**Fix sketch:** compute the real fork point
(`git merge-base <branch> <parent>`) instead of assuming `~1`, or document
the one-commit-per-slice constraint explicitly.

## In `~/git-stack` (separate repo — `zcaceres/git-stack`)

Line numbers reference `bin/git-stack` at v0.3.0.

### 3. `--force-with-lease` silently degrades to `--force` (`:319`)

```bash
git push --force-with-lease origin "$branch" 2>/dev/null || git push -u origin "$branch" ...
```

The lease carries no explicit expectation (no `=<sha>`), and `cmd_submit`
never fetches first, so the lease is evaluated against a possibly-stale
`origin/<branch>` tracking ref — the classic way `--force-with-lease`
quietly becomes `--force` and can clobber a teammate's push. The
`|| git push -u` fallback also can't distinguish "no upstream yet" from
"lease genuinely rejected"; it just retries.

**Fix sketch:** `git fetch` the branch before pushing, and/or pass an
explicit `--force-with-lease=<branch>:<expected-sha>`.

### 4. JSON parsed with grep/sed, not `--jq` (`:247, :323, :522, :588`)

```bash
grep -o "{[^}]*\"headRefName\":\"$branch\"[^}]*}"
```

Two failure modes: `$branch` is interpolated into a regex **unescaped** (a
branch name with regex metacharacters mismatches), and `[^}]*` breaks on any
nested object in the JSON. Separately, `gh pr list --limit 50` silently
drops PR 51+.

**Fix sketch:** use `gh ... --jq` (or pipe through `jq`) keyed on
`.headRefName == $branch`; raise or paginate past `--limit 50`.

### 5. Subshell counters are discarded (`:307, :664`)

Every main loop is `echo "$list" | while read …`, which runs in a subshell.
`merged` (`:664`) and `pushed` (`:307`) never escape it, so the final tallies
print the **planned** count (`stack_count - 1` at `:346`, `merge_count` at
`:677`), not the achieved one. A `die` inside the loop only exits the
subshell — the script continues via `pipefail`/`set -e` on the pipeline, not
directly.

**Fix sketch:** feed the loop with a process substitution
(`while read …; do …; done < <(printf '%s\n' "$list")`) so counters persist.

### 6. `wait_for_retarget` is dead code (`:462-477`)

Defined with exponential backoff, **never called**. The hard-coded
`sleep 2` at `:641` is what actually runs before the child-PR retarget.

**Fix sketch:** call `wait_for_retarget` where the `sleep 2` is, or delete
the dead function.

### 7. `cmd_sync` dirty-tree check precedes flag parsing (`:382` vs `:386`)

The working-tree cleanliness `die` at `:382` runs **before** the flag parse
at `:386`, so `git stack sync --help` fails on a dirty tree instead of
printing usage.

**Fix sketch:** parse flags (and handle `-h/--help`) before the dirty-tree
guard.

### 8. `/tmp` temp files are predictable and not trap-cleaned (`:528, :564`)

`/tmp/git-stack-merge-$$` and `/tmp/git-stack-tips-$$` use predictable
names and no `trap … EXIT` cleanup, so a `die` mid-loop leaves them behind.

**Fix sketch:** `mktemp` + a cleanup trap, or hold the data in a shell
variable/array instead of a temp file.
