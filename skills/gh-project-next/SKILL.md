---
name: gh-project-next
description: Pick the next card to work on from the repo's GitHub Projects kanban. Surfaces the top 3-5 Todo cards with body previews and signals, lets the user pick one, confirms moving it to In Progress, and dumps the full card context so the agent can start work. Stops at the context handoff — does not create branches or edit code. Use when the user says "what's next", "pick next ticket", "what should I work on", or "/gh-project-next".
---

# gh-project-next

You are picking the next card for the user to work on from the repository's GitHub Projects kanban board, moving it to `In Progress`, and handing off the full context so the user (or you) can begin work.

This skill **stops at the context dump**. It does not create branches, edit files, or start coding — that's deliberate. The user picks the next slicing/branching decision themselves, or invokes `/checkpoint` later.

## When to use

- "what's next" / "what should I work on"
- "pick next ticket" / "get next task" / "next card"
- "/gh-project-next"

## Prerequisites

**CRITICAL:** Before doing anything, check if `.github/gh-project.json` exists.
- If it does NOT exist, **log a prominent warning** to the user:
  > "WARNING: GitHub Project configuration is missing. The gh-project skill suite cannot function without a linked project board."
- Prompt the user to run `/gh-project-setup` first to bootstrap the configuration.
- Do NOT proceed. Stop immediately.

```bash
if [ ! -f .github/gh-project.json ]; then
  echo "WARNING: No GitHub Project configuration file found at .github/gh-project.json."
  echo "Please run /gh-project-setup first to configure your project board."
  exit 1
fi

HELPER=.github/scripts/gh-project-board.sh
if [ ! -x "$HELPER" ]; then
  echo "WARNING: Missing or non-executable helper script at $HELPER."
  echo "Please run /gh-project-setup to regenerate the board helper script."
  exit 1
fi

REPO_OWNER=$(jq -r .repoOwner .github/gh-project.json)
REPO=$(jq -r .repo .github/gh-project.json)
```

## Step 1 — List the Todo column

Use the helper with a server-side filter so the agent only sees what it needs:

```bash
$HELPER list --query "status:Todo" > /tmp/todos.jsonl
TODO_COUNT=$(wc -l < /tmp/todos.jsonl)
```

If `TODO_COUNT` is 0:

> "Todo column is empty. Either everything's in flight, or the board's out of date. Want to run `/gh-project-review` to audit?"

Stop. Don't try to fall back to `In Progress` or `Done` — those imply different things.

If `TODO_COUNT` is between 1 and 5: show all of them.
If `TODO_COUNT` is greater than 5: show the top 5 in board order (the order `item-list` returns is the column order) and note how many more exist:

> "Showing 5 of N Todo cards (in board order). Pass a substring to narrow if you want a specific one."

## Step 2 — Show candidates with signal

For each candidate, show:

- **Position** (1, 2, 3...) — what the user types to pick
- **Title**
- **Type + identifier** — `Issue #23` / `Draft`
- **Body preview** — first ~120 chars from `bodyPreview` field
- **Signals** — gather these only if they're cheap and useful. Don't pad with noise:
  - Milestone (issue-backed cards): `gh issue view <n> --json milestone --jq .milestone.title`
  - Labels (issue-backed): `gh issue view <n> --json labels --jq '.labels | map(.name) | join(", ")'`
  - Age: `gh issue view <n> --json createdAt` → render as "5 days ago" / "3 weeks ago"
  - Linked PRs: `gh issue view <n> --json closedByPullRequestsReferences,timelineItems`

Batch these `gh issue view` calls in parallel — one per card — rather than sequentially.

Render compactly:

```markdown
### Pick a card to work on next

**1.** "Add CSV export" — Issue #42 · 3 weeks old · milestone: v0.4 · labels: feature
> Add a button on the Reports page that downloads the current filtered table as a CSV. The current export is JSON only.

**2.** "Fix flaky retry test" — Issue #51 · 5 days old · labels: bug, p1
> integration-tests/retry.test.ts fails ~10% of the time in CI. Suspect race in the mock server setup.

**3.** "Document the new auth flow" — Draft · 2 days old
> (no body)

…

Reply with a number (1-N), a title substring, or "skip" to see more.
```

## Step 3 — Wait for the pick

Accept:
- A number → pick that row
- A substring → match against the candidate titles (case-insensitive). If 0 matches in the shown list, fall back to searching all Todo cards.
- "more" / "show more" → display rows 6-10 (and so on)
- "none" / "skip" → stop without changing anything

Don't pick for the user. If their input is ambiguous, ask again.

## Step 4 — Confirm move to In Progress

After the pick:

```markdown
Picked: "Add CSV export" (PVTI_…, Issue #42)
Move to **In Progress**? (yes/no, default yes)
```

Accept "yes", "y", "" (empty/Enter), "ok" as yes. Anything else → leave status as Todo and proceed to the context dump.

If yes, apply the status move:
```bash
$HELPER set-status "$ITEM_ID" "In Progress"
```

If the helper errors (unknown status, network), surface the error and ask whether to proceed with the context dump anyway. Don't silently swallow the failure.

## Step 5 — Dump the full context

Now hand off to the agent / user. Pull the full row + linked context. Show:

```markdown
## Working on: <title>

**Card:** `<PVTI_…>`  ·  **Status:** In Progress (was Todo)
**Type:** Issue #<n>  ·  **URL:** <url>
**Milestone:** <name or —>
**Labels:** <comma-separated or —>
**Linked PRs:** <list of #N or —>

### Body

<full body, no truncation>

### Referenced files

<heuristic grep of body for paths matching ./?[a-z][a-zA-Z0-9_/.-]*\.\w+; list each that exists in the working tree. Show 1 line per file. Skip if none found.>

### Comments

<if issue-backed and has comments: count + last comment summary. Skip if none.>
```

For the `Referenced files` extraction, use a cheap heuristic — pull anything that looks like a path with an extension from the body and check existence:

```bash
echo "$BODY" \
  | grep -oE '[a-zA-Z0-9_./-]+\.[a-z]{1,5}\b' \
  | sort -u \
  | while read -r p; do [[ -f "$p" ]] && echo "$p"; done
```

Don't open the files. Don't grep them. Just list. The user/agent decides what to read.

## Step 6 — One-line "what to do next" pointer

End with a single line that nudges next action without committing to it:

> "Card is now In Progress. When you've cut your first slice, run `/checkpoint` to stack a PR."

If the card has linked PRs (suggesting work is already underway), instead say:

> "This card has open linked PR #<n>. Read it first before starting new work."

## Edge cases

- **No Todo cards.** Stop with the audit prompt above. Don't pick from other columns.
- **One Todo card.** Skip the numbered list — just present it and ask "Move to In Progress and start? (yes/no)".
- **User picks a substring that matches multiple shown cards.** Re-list just the matches and ask for a number.
- **User picks a substring that matches none of the shown cards.** Search the full Todo column. If still no match, ask them to pick from the displayed list or pass a different substring.
- **Card already has assignees and the assignee isn't the user.** Surface it: "This card is assigned to @other-user. Take it anyway?"
- **Card body references files that don't exist.** Skip those silently in the file list — don't list ghost paths.
- **`--auto` flag.** If invoked as `/gh-project-next --auto`, skip step 3's pick and the step 4 confirmation; take the first Todo, move it, dump. Useful for `/loop` style automation.

## Guidelines

- **Don't rank past the board's own order.** The kanban column ordering is the user's prioritization. Don't second-guess it with label-based heuristics unless the user asks ("pick the p0 next").
- **One card per invocation.** Even if the user says "give me three", picking one at a time is the contract. Re-invoke for the next.
- **Stop at the context dump.** No branch creation, no edits, no planning conversation. The skill's job ends when the agent knows what the card is.
- **Don't reorder the board.** Listing in board order ≠ rearranging it. If the user wants to reorder, that's manual on github.com.
- **Respect the user's `--auto` for headless runs, but log the pick** so they can audit later.
