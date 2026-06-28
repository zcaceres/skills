# `/stacked-pr-gemini log` — Visualize the PR(s)

Read-only. Show the open PR(s) for your current work.

## Mode

- **normal mode** → just the current branch's PR. Run:

  ```bash
  gh pr status
  ```

  Or, scoped to the current branch:

  ```bash
  gh pr view --json number,state,baseRefName,url,title -q '.' 2>/dev/null \
    || gh pr list --head "$(git branch --show-current)" --state all \
         --json number,state,baseRefName,url,title -q '.[0]'
  ```

  Print the PR number, state, base, title, and URL. If there's no PR for
  the branch yet, say so and suggest `/stacked-pr-gemini` to open one. Stop here — the
  rest of this file is the stacked-mode view.

- **stacked mode** → the full stack tree (continue below).

## Stacked-mode workflow

Print the current stack's structure, each branch's PR (if open), each
PR's base, and each PR's state (open/merged/closed).

Uses `git stack log` when installed, otherwise composes the same view
from `git config` + `gh pr list`.

### 1. Detect `git stack`

```bash
git stack --version 2>/dev/null
```

If this succeeds → **git-stack path** (step 2A).
Otherwise → **fallback path** (step 2B).

### 2A. git-stack Path

```bash
git stack log
```

This prints the stack tree plus PR status. Pass the output straight
through to the user — don't re-format it.

If the user asked for richer information than `git stack log` shows
(e.g. they said "with bodies"), fall through to step 2B to compose the
extra detail via `gh`.

### 2B. Fallback Path (no `git stack`)

Walk the stack manually by reading `branch.<name>.stack-parent` git
config entries:

```bash
CURRENT=$(git branch --show-current)
BRANCH="$CURRENT"
STACK=()
while [[ -n "$BRANCH" ]]; do
  STACK=("$BRANCH" "${STACK[@]}")
  BRANCH=$(git config "branch.$BRANCH.stack-parent" 2>/dev/null)
done
```

`STACK` now holds the branches from bottom (oldest parent) to top
(current). If the bottom entry doesn't have a `stack-parent`, it's the
trunk-adjacent base.

Then for each branch (top down or bottom up, your choice — be
consistent), gather:

- Tip + parent SHA:
  ```bash
  git log --oneline -1 "origin/$BRANCH" 2>/dev/null
  git rev-parse --short "origin/$BRANCH~1" 2>/dev/null
  ```
- Open PR for the branch:
  ```bash
  gh pr list --head "$BRANCH" --state all --json number,baseRefName,state,url,title \
    -q '.[0]'
  ```

Batch the `gh pr list` calls in parallel — one per branch — not in a
serial loop.

### 3. Render

Compact, readable. Bottom branch first. Indent children. Include:

- Branch name
- PR number + state (open/merged/closed) — `—` if no PR
- PR base
- PR URL — `—` if no PR

Example:

```
stacked-pr/01-scaffold   PR #53 open  base: main                    https://github.com/…/53
└─ stacked-pr/02-submit-log-sync  PR #54 open  base: stacked-pr/01-scaffold  https://github.com/…/54
```

If a branch is on the local stack but has no remote ref yet, mark it
`(unpushed)` and skip the PR lookup.

Published PR titles carry a `[<name> N/M]` stack marker (see
[title-convention.md](title-convention.md)). Show it as part of the title
when you render titles. Locally-built, not-yet-submitted branches have no
PR (mark them `(unpushed)`). If a title's `N/M` looks stale — e.g. it
survived a `/stacked-pr-gemini merge` that didn't relabel — note that `/stacked-pr-gemini submit` will
refresh the markers; don't rewrite them here (this subcommand is
read-only).

## Important

- This subcommand is read-only. Never rebase, push, or open PRs from
  `/stacked-pr-gemini log`.
- If the user wants to act on what they see — retarget a base, rebase
  a branch — direct them to `/stacked-pr-gemini sync` or `/stacked-pr-gemini merge`.
- If `gh` isn't authenticated, surface the auth error verbatim. Don't
  swallow it.
