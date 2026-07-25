# `/pr log` (jj) — Visualize the PR(s)

Read-only. Show the open PR(s) for your current work.

This is the jj-backend variant of [log.md](../log.md). The stack is
derived from ancestry (`trunk()..@`), not from
`branch.<name>.stack-parent` config, and `jj log` renders the tree
natively.

## Mode

- **normal mode** → just the current bookmark's PR. Resolve the bookmark
  first — the colocated git `HEAD` is detached, so `gh` can't infer the
  branch:

  ```bash
  BRANCH=$(jj log -r 'heads(::@ & bookmarks())' --no-graph \
    -T 'local_bookmarks.map(|b| b.name()).join(" ")')
  gh pr list --head "$BRANCH" --state all \
    --json number,state,baseRefName,url,title -q '.[0]'
  ```

  (`gh pr status` works as a broader fallback when `$BRANCH` is empty.)

  Print the PR number, state, base, title, and URL. If there's no PR for
  the bookmark yet, say so and suggest `/pr` to open one. Stop here — the
  rest of this file is the stacked-mode view.

- **stacked mode** → the full stack tree (continue below).

## Stacked-mode workflow

Print the current stack's structure, each bookmark's PR (if open), each
PR's base, and each PR's state (open/merged/closed).

### 1. Render the Local Tree

```bash
jj log -r 'trunk()..@ | trunk()'
```

This shows the whole stack: bookmarks, change IDs, `@`, and conflict /
empty markers. Pass the output straight through to the user — don't
re-format it.

### 2. Gather PR Status

Derive the stack, bottom to top:

```bash
STACK=($(jj log -r 'trunk()..@ & bookmarks()' --no-graph --reversed \
  -T 'local_bookmarks.map(|b| b.name()).join(" ") ++ "\n"'))
```

Then for each bookmark, gather its PR (batch the `gh pr list` calls in
parallel — one per bookmark — not in a serial loop):

```bash
gh pr list --head "$B" --state all --json number,baseRefName,state,url,title \
  -q '.[0]'
```

If a bookmark has no remote ref yet, mark it `(unpushed)` and skip the PR
lookup — colocated git makes this the cheapest check:

```bash
git rev-parse --verify "origin/$B" >/dev/null 2>&1
```

### 3. Render

Compact, readable. Bottom bookmark first. Indent children. Include:

- Bookmark name
- PR number + state (open/merged/closed) — `—` if no PR
- PR base
- PR URL — `—` if no PR

Example:

```
stacked-pr/01-scaffold   PR #53 open  base: main                    https://github.com/…/53
└─ stacked-pr/02-submit-log-sync  PR #54 open  base: stacked-pr/01-scaffold  https://github.com/…/54
```

Published PR titles carry a `[<name> N/M]` stack marker (see
[title-convention.md](../title-convention.md)). Show it as part of the
title when you render titles. Locally-built, not-yet-submitted bookmarks
have no PR (mark them `(unpushed)`). If a title's `N/M` looks stale —
e.g. it survived a `/pr merge` that didn't relabel — note that
`/pr submit` will refresh the markers; don't rewrite them here (this
subcommand is read-only).

A bookmark rendered as `name??` in jj output is **conflicted** (local and
remote positions diverged). Don't fix it here — direct the user to
`/pr sync`, which guards on conflicted bookmarks and explains the
resolution.

## Important

- This subcommand is read-only. Never rebase, push, or open PRs from
  `/pr log`.
- If the user wants to act on what they see — retarget a base, restack,
  resolve a conflicted bookmark — direct them to `/pr sync` or
  `/pr merge`.
- If `gh` isn't authenticated, surface the auth error verbatim. Don't
  swallow it.
