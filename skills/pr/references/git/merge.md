# `/pr merge` — Land the Stack

Merge stacked pull requests through GitHub's stack-aware operation. All open
pull requests from the bottom through the selected target merge as one
all-or-nothing request.

Never merge stack layers individually with `gh pr merge`.

## Flags

- `--merge` (default), `--rebase`, or `--squash` — choose the merge method.
- `--all` — target the top branch's PR; without it, target the current branch's
  PR and merge every layer below it.
- `--dry-run` — show the stack and proposed merge method, then stop.

## Workflow

### 1. Pre-flight and choose the target

```bash
gh stack --help >/dev/null || {
  echo 'Install the official extension: gh extension install github/gh-stack' >&2
  exit 1
}
git status --porcelain
gh stack view
```

Stop if the working tree is dirty. By default, merge through the current
branch's PR. With `--all`, identify the top PR from `gh stack view` and pass its
number to `gh stack merge`.

For `--dry-run`, report the displayed stack, selected target, and merge method,
then stop.

### 2. Merge through `gh stack`

Map the requested method to `--merge`, `--rebase`, or `--squash`:

```bash
# Merge through the current branch's PR:
gh stack merge --yes --rebase

# With --all, merge through the top PR explicitly:
gh stack merge <top-pr-number> --yes --rebase
```

Do not fall back to `gh pr merge`, call the stack merge API by hand, delete base
branches, or manually retarget child PRs. Surface any failure and stop rather
than bypassing GitHub's merge requirements.

### 3. Synchronize the result

After the complete stack lands, remove merged local branches and synchronize
PR state:

```bash
gh stack sync --prune
```

If only part of the stack was selected, GitHub rebases and retargets the
remaining PRs. Synchronize them without pruning the active remainder:

```bash
gh stack sync
```

Do not rebuild or retarget the remaining stack manually.

### 4. Report

Report which PRs merged, the selected merge method, and the resulting
`gh stack view`. If GitHub queued the operation, report that state rather than
claiming it has already landed.

## Important

- `/pr merge` is irreversible. Run it only when the user explicitly asks.
- Never try to bypass GitHub merge requirements.
- Never use `gh pr merge` for a stacked pull request.
