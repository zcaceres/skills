# `/pr log` — Visualize the PR(s) (jj)

Read-only. Show the open PR(s) for your current work.

This is the **jj** path. The stack comes straight from the commit graph —
no `stack-parent` config to walk.

## Mode

- **normal mode** → just the current change's PR:

  ```bash
  BR=$(jj log -r @ --no-graph -T 'bookmarks')     # try @, then @-
  [ -z "$BR" ] && BR=$(jj log -r @- --no-graph -T 'bookmarks')
  gh pr list --head "$BR" --state all \
    --json number,state,baseRefName,url,title -q '.[0]'
  ```

  Print the PR number, state, base, title, and URL. If there's no PR yet,
  say so and suggest `/pr` to open one. Stop here — the rest is the
  stacked-mode view.

- **stacked mode** → the full stack tree (continue below).

## Stacked-mode workflow

### 1. Detect the Trunk Bookmark

```bash
if   [ -n "$(jj bookmark list main   2>/dev/null)" ]; then TRUNK=main
elif [ -n "$(jj bookmark list master 2>/dev/null)" ]; then TRUNK=master
else echo "No trunk bookmark (main/master)." >&2; exit 1; fi
```

### 2. Enumerate the Stack

```bash
jj log -r "${TRUNK}..@" --no-graph --reversed \
  -T 'change_id.short() ++ "\t" ++ bookmarks ++ "\t" ++ description.first_line() ++ "\n"'
```

Bottom (trunk-adjacent) → top. A slice with an empty bookmark column is
built locally but not yet publishable — mark it `(no bookmark)`.

### 3. Attach PR Status

For each slice **with a bookmark**, look up its PR (fire these in
parallel — one per bookmark, not a serial loop):

```bash
gh pr list --head "<bookmark>" --state all \
  --json number,baseRefName,state,url,title -q '.[0]'
```

A bookmark with no remote ref yet is `(unpushed)` — skip its PR lookup.

Also surface conflicts, since a jj rebase can leave them silently:

```bash
jj log -r "conflicts() & (${TRUNK}..@)" --no-graph -T 'bookmarks ++ "\n"'
```

Mark any listed slice `(CONFLICTED)`.

### 4. Render

Compact, readable, bottom first. For each slice: bookmark, PR number +
state (`—` if none), base, URL, and `(unpushed)` / `(CONFLICTED)` /
`(no bookmark)` where they apply. Example:

```
feat-scaffold         PR #53 open  base: main           https://…/53
└─ feat-submit-log     PR #54 open  base: feat-scaffold   https://…/54
```

Published PR titles carry a `[<name> N/M]` marker (see
[title-convention.md](../title-convention.md)) — show it. If a marker
looks stale, note that `/pr submit` refreshes it; don't rewrite it here.

## Important

- Read-only. Never rebase, push, or open PRs from `/pr log`.
- To act on what you see, direct the user to `/pr sync` or `/pr merge`.
- If `gh` isn't authenticated, surface the auth error verbatim.
