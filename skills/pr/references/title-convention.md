# Stacked-PR Title Markers

In stacked mode, every PR's title carries a marker so it's obvious **at a
glance** — in the GitHub PR list, notifications, anywhere — that the PR is
part of a stack and *where* it sits in it.

## Format

```
[<name> N/M] <your real title>
```

- `<name>` — a short, stable name for the **whole stack**: the ticket
  identifier the work is tracked under (e.g. `ENG-456`) when one is
  present, else a slug derived from the bottom branch. Lets you tell one
  stack from another and ties the PRs back to the ticket.
- `N` — this PR's position from the bottom (1 = bottom, lands first).
- `M` — total number of PRs in the stack.

A four-PR stack tracked under ticket `ENG-456`:

```
[ENG-456 1/4] Add token model
[ENG-456 2/4] Add token middleware
[ENG-456 3/4] Wire middleware into the router
[ENG-456 4/4] Document the auth flow
```

The same stack with no ticket (name derived from the bottom branch
`feat/auth`):

```
[auth 1/4] Add token model
...
```

Only the bracket prefix is managed; **your real title text is preserved**.

## When markers are (re)written

Markers are applied by the **renumber routine** below, which is run as a
post-pass at the moment the stack is published or re-published:

- [`/pr submit`](submit.md) — the publish point on the git-stack path.
  Checkpoints are built locally and unpublished, so this is where the whole
  stack first gets numbered, and re-numbered on every re-`submit`.
- [`/pr update`](update.md) — on its stacked (git-stack) path, which
  re-publishes the stack.
- [`/pr checkpoint`](checkpoint.md) — **only** on its `gh`-fallback path,
  which still publishes eagerly. The git-stack `checkpoint` is local and
  publishes nothing, so it does not renumber.

It is **not** run by [`/pr merge`](merge.md). As PRs land bottom-up, the
surviving labels read stale (`2/4` after the bottom merges) until the next
`submit` renumbers them. That's a deliberate trade — `merge` stays focused
on landing the stack, not rewriting titles.

Running it as a post-pass (plain `gh pr edit`) makes it path-agnostic: it
overrides whatever `git stack submit` set the titles to, so the markers
survive git-stack's own title handling.

## The renumber routine

Self-contained. Run it verbatim (or adapt the `gh` lookups to run in
parallel — correctness matters more than speed here).

```bash
strip_marker() {
  # Drop a leading "[<anything> N/M] " marker, if present. Leaves other
  # bracket prefixes (e.g. "[WIP]") untouched — they lack the N/M pattern.
  printf '%s' "$1" | sed -E 's/^\[[^]]*[0-9]+\/[0-9]+\][[:space:]]*//'
}

# 1. Build the stack bottom -> top (same walk as log.md / merge.md).
CURRENT=$(git branch --show-current)
BRANCH="$CURRENT"
STACK=()
while [[ -n "$BRANCH" ]]; do
  STACK=("$BRANCH" "${STACK[@]}")
  BRANCH=$(git config "branch.$BRANCH.stack-parent" 2>/dev/null)
done

# 2. Drop the trunk if the walk reached it — it has no PR and isn't a
#    stack member.
if git rev-parse --verify origin/main >/dev/null 2>&1; then TRUNK=main
elif git rev-parse --verify origin/master >/dev/null 2>&1; then TRUNK=master
else TRUNK=main; fi
FILTERED=()
for B in "${STACK[@]}"; do
  [[ "$B" == "$TRUNK" ]] && continue
  FILTERED+=("$B")
done
STACK=("${FILTERED[@]}")

# 3. Collect the open PR (number + current title) for each branch, in
#    order. Branches with no open PR (e.g. unpushed top) are skipped and
#    don't count toward M.
BRANCHES=(); PRS=(); TITLES=()
for B in "${STACK[@]}"; do
  ROW=$(gh pr list --head "$B" --state open --json number,title \
        -q '.[0] | select(. != null) | "\(.number)\t\(.title)"' 2>/dev/null)
  [[ -z "$ROW" ]] && continue
  BRANCHES+=("$B"); PRS+=("${ROW%%$'\t'*}"); TITLES+=("${ROW#*$'\t'}")
done
M=${#PRS[@]}

# 4. Stack name, in precedence order:
#    a) an explicit per-stack label, if set;
#    b) a ticket identifier (e.g. ENG-456) found in the bottom branch name,
#       else in the bottom branch's first commit subject;
#    c) the bottom branch's leaf (last path segment, leading "NN-"/"NN_"
#       stripped).
# Ticket pattern: an uppercase project key of 2+ letters, a dash, digits
# (JIRA / Linear style). Tight enough not to match "layer-1".
BOTTOM="${STACK[0]}"
SLUG=$(git config "branch.$BOTTOM.stack-label" 2>/dev/null)
if [[ -z "$SLUG" ]]; then
  TICKET=$(printf '%s' "$BOTTOM" | grep -oE '[A-Z]{2,}-[0-9]+' | head -1)
  if [[ -z "$TICKET" ]]; then
    SUBJECT=$(git log -1 --format=%s "$BOTTOM" 2>/dev/null)
    TICKET=$(printf '%s' "$SUBJECT" | grep -oE '[A-Z]{2,}-[0-9]+' | head -1)
  fi
  if [[ -n "$TICKET" ]]; then
    SLUG="$TICKET"
  else
    SLUG="${BOTTOM##*/}"
    SLUG="${SLUG#[0-9][0-9]-}"; SLUG="${SLUG#[0-9][0-9]_}"
  fi
fi

# 5. Apply. A lone PR (M<2) is not a stack — strip any stale marker, add
#    none. Otherwise prefix each PR with "[<name> N/M] ", idempotently.
if (( M < 2 )); then
  if (( M == 1 )); then
    CLEAN=$(strip_marker "${TITLES[0]}")
    [[ "$CLEAN" != "${TITLES[0]}" ]] && gh pr edit "${PRS[0]}" --title "$CLEAN"
  fi
else
  i=0
  while (( i < M )); do
    N=$(( i + 1 ))
    CLEAN=$(strip_marker "${TITLES[$i]}")
    NEW="[$SLUG $N/$M] $CLEAN"
    [[ "$NEW" != "${TITLES[$i]}" ]] && gh pr edit "${PRS[$i]}" --title "$NEW"
    i=$(( i + 1 ))
  done
fi
```

## Naming the stack

The name is resolved in this order:

1. **Explicit label** — `branch.<bottom>.stack-label`, if set.
2. **Ticket identifier** — an uppercase `KEY-123` token (JIRA / Linear
   style) found in the bottom branch name (e.g. `feat/ENG-456-auth` →
   `ENG-456`), or failing that, in the bottom branch's first commit
   subject. Ties every PR in the stack back to the ticket.
3. **Derived slug** — the bottom branch's leaf name with any leading
   `NN-`/`NN_` stripped (`feat/auth` → `auth`, `stacked-pr/01-scaffold` →
   `scaffold`).

To pin a custom name regardless of branch/ticket, set the label once on
the bottom branch:

```bash
git config "branch.<bottom-branch>.stack-label" auth-rework
```

> The ticket pattern is `[A-Z]{2,}-[0-9]+` — deliberately strict (uppercase
> key, 2+ letters) so it matches `ENG-456` but not coincidental
> `word-number` branch names like `layer-1`. If your tickets look
> different (lowercase keys, GitHub `#123` issues), adjust the pattern in
> step 4 of the routine or use an explicit `stack-label`.

## Notes

- **Idempotent.** Re-running strips the previous `[… N/M]` before writing
  the new one, so titles never accumulate `[a 2/4] [a 3/4] …`.
- **Single PRs stay clean.** A non-stacked branch (M<2) never gets a
  marker, and a stale one is removed if the stack shrank to one PR.
- **Raw `git stack submit` (outside `/pr`)** resets titles to its own
  defaults. The next `/pr submit` or `/pr checkpoint` re-applies markers.
