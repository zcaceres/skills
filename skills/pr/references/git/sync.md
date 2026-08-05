# `/pr sync` — Synchronize the Stack

Synchronize the current `gh stack` with GitHub: fetch, reconcile remote stack
state, fast-forward the trunk, cascade-rebase layers as necessary, force-push
safely, and refresh pull-request/stack state.

## Flags

- `--no-push` — rebase locally without pushing. This is implemented with
  `gh stack rebase`, because `gh stack sync` intentionally always pushes.

## Workflow

### 1. Pre-flight

```bash
gh stack --help >/dev/null || {
  echo 'Install the official extension: gh extension install github/gh-stack' >&2
  exit 1
}
git status --porcelain
```

If anything is uncommitted, stop. Do not auto-stash: different layers may own
different work.

### 2. Synchronize

For normal synchronization:

```bash
gh stack sync
```

For `--no-push`, fetch and cascade-rebase locally without pushing:

```bash
gh stack rebase
```

If a rebase conflicts, stop. Tell the user to resolve, stage the resolution,
then run `gh stack rebase --continue`; `gh stack rebase --abort` restores the
stack to its pre-rebase state.

### 3. Report

Run `gh stack view` and report the resulting branch/PR state. When using
`--no-push`, explicitly say that the rebased branches remain local and require
`gh stack push` (or `/pr submit`) after inspection/testing.

## Important

- Never use plain `git push --force`.
- Do not manually retarget child PRs; `gh stack` owns the remote stack state.
- Do not auto-resolve conflicts.
