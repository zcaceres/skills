# `/gh-project next` — Pick the Next Card

You are picking the next card for the user to work on from the repository's GitHub Projects kanban board, moving it to `In Progress`, and handing off the full context so the user (or you) can begin work.

By default this subcommand ranks Todo cards using a **contextual** notion of "logically next" — it inspects whatever organizational signals the project actually uses (milestones, phase/priority labels, age) and picks an ordering that fits. The raw column order is treated as a tiebreaker, not the primary signal. Pass `--board-order` to skip ranking and use the column's manual order verbatim (today's behavior).

This subcommand **stops at the context dump**. It does not create branches, edit files, or start coding — that's deliberate. The user picks the next slicing/branching decision themselves, or invokes `/stacked-pr checkpoint` later.

## When to use

- "what's next" / "what should I work on"
- "pick next ticket" / "get next task" / "next card"
- "/gh-project next"

## Prerequisites

**CRITICAL:** Before doing anything, check if `.github/gh-project.json` exists.
- If it does NOT exist, **log a prominent warning** to the user:
  > "WARNING: GitHub Project configuration is missing. The gh-project skill suite cannot function without a linked project board."
- Prompt the user to run `/gh-project setup` first to bootstrap the configuration.
- Do NOT proceed. Stop immediately.

```bash
if [ ! -f .github/gh-project.json ]; then
  echo "WARNING: No GitHub Project configuration file found at .github/gh-project.json."
  echo "Please run /gh-project setup first to configure your project board."
  exit 1
fi

HELPER=.github/scripts/gh-project-board.sh
if [ ! -x "$HELPER" ]; then
  echo "WARNING: Missing or non-executable helper script at $HELPER."
  echo "Please run /gh-project setup to regenerate the board helper script."
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

> "Todo column is empty. Either everything's in flight, or the board's out of date. Want to run `/gh-project review` to audit?"

Stop. Don't try to fall back to `In Progress` or `Done` — those imply different things.

If `--board-order` was passed, skip to **Step 3 (display)** and present cards in `/tmp/todos.jsonl` order. Otherwise continue to Step 2 to rank them.

## Step 2 — Gather signals and rank

### 2a. Pull signals for every Todo card in one call

We need labels, milestone, createdAt, and assignees for **all** Todo cards before we can rank. Don't loop `gh issue view` per card — make a single `gh issue list` call and join by issue number:

```bash
ISSUE_NUMS=$(jq -r 'select(.type == "Issue") | .number' /tmp/todos.jsonl | paste -sd, -)
gh issue list \
  --repo "$REPO_OWNER/$REPO" \
  --state open \
  --limit 200 \
  --json number,title,labels,milestone,createdAt,assignees \
  > /tmp/issue-signals.json
```

Then for each Todo card, look up its signals by number. Draft cards (no `number`) only have title + body + project createdAt — they get ranked on age alone.

### 2b. Decide the ranking scheme contextually

There is **no fixed algorithm.** Different projects organize work differently — some use milestones with due dates, some use "Phase 1 / Phase 2" labels, some use `p0/p1/p2` priority labels, many use a mix or none at all. Pattern-matching labels in isolation is brittle. Instead, survey the *set* of signals actually in use across the Todo column, decide which organizational dimensions are real for this project, and apply them.

Walk through these questions in order:

1. **Are milestones in use?** Look at how many Todo cards have a milestone, whether those milestones have due dates, and whether multiple milestones appear. If most cards belong to a milestone with a due date, that's the primary axis — sooner-due milestones come first.
2. **Are phase-like labels in use?** Scan the label set across the column. Are there multiple labels that look like ordered phases (e.g. "Phase 1" / "Phase 2", "v1" / "v2", "stage-1" / "stage-2", "milestone-a" / "milestone-b")? If several cards carry such labels and there's a clear ordering, earlier phases come first. If only one card has a phase label, the dimension isn't really in use — skip it.
3. **Are priority/severity labels in use?** Look for labels like `p0/p1/p2`, `critical`, `blocker`, `urgent`, `important`, `high`, `low`. If multiple cards have them, treat higher priority as a boost on top of the phase/milestone ordering.
4. **Are blocking labels in use?** `blocked`, `needs-design`, `on-hold`, `waiting-on-*`, `wontfix`. Demote cards with these to the bottom of the list (or omit if `wontfix`).
5. **Fallback when no organizational signals exist.** If the project doesn't use milestones, phase labels, or priority labels, rank by age (oldest unblocked Todo first — it's been waiting longest), with board order as the final tiebreaker.

Use the *board order* (the order `item-list` returned) only as the final tiebreaker within an equivalence class. Don't override organizational signals with it — the user can pass `--board-order` if they want that.

Decide on the scheme before listing candidates, and remember it for the "why" annotations in Step 3.

### 2c. Pick the top 5

Apply the chosen scheme, take the top 5, and write a short scheme summary you'll show the user at the top of the list (e.g. "Ranking by milestone due date, then priority labels, then age"). If only 1–5 Todo cards exist, show all of them; the scheme summary still helps the user sanity-check the order.

## Step 3 — Show candidates with signal

Lead with the ranking scheme so the user can sanity-check it, then list the candidates with a one-line "why" each:

```markdown
### Pick a card to work on next

_Ranking by milestone due date → priority labels → age. Pass `--board-order` to use raw column order._

**1.** "Fix flaky retry test" — Issue #51 · 5 days old · milestone: v0.4 (due in 6d) · labels: bug, p0
> integration-tests/retry.test.ts fails ~10% of the time in CI. Suspect race in the mock server setup.
> _Why: v0.4 is the soonest-due milestone and this is the only p0 in it._

**2.** "Add CSV export" — Issue #42 · 3 weeks old · milestone: v0.4 (due in 6d) · labels: feature
> Add a button on the Reports page that downloads the current filtered table as a CSV. The current export is JSON only.
> _Why: same milestone as #1, no priority label, oldest of the v0.4 features._

**3.** "Document the new auth flow" — Draft · 2 days old
> (no body)
> _Why: no milestone, no priority, ranked on age within the no-milestone bucket._

…

Reply with a number (1-N), a title substring, or "skip" to see more.
```

Keep the "why" line short and concrete — name the signals you used. If a card was demoted (e.g. has `blocked`), say so explicitly: "_Why: ranked low — labeled `blocked`._"

If `--board-order` was passed, omit the scheme summary and the "why" lines, and show cards in column order with the original signal layout (Title · Type · age · milestone · labels + body preview).

## Step 4 — Wait for the pick

Accept:
- A number → pick that row
- A substring → match against the candidate titles (case-insensitive). If 0 matches in the shown list, fall back to searching all Todo cards.
- "more" / "show more" → display the next 5 rows in the chosen ranking (or board order, if `--board-order`)
- "none" / "skip" → stop without changing anything

Don't pick for the user. If their input is ambiguous, ask again.

## Step 5 — Confirm move to In Progress

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

## Step 6 — Dump the full context

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

## Step 7 — One-line "what to do next" pointer

End with a single line that nudges next action without committing to it:

> "Card is now In Progress. When you've cut your first slice, run `/stacked-pr checkpoint` to stack a PR."

If the card has linked PRs (suggesting work is already underway), instead say:

> "This card has open linked PR #<n>. Read it first before starting new work."

## Edge cases

- **No Todo cards.** Stop with the audit prompt above. Don't pick from other columns.
- **One Todo card.** Skip the numbered list and the ranking step — just present it and ask "Move to In Progress and start? (yes/no)".
- **User picks a substring that matches multiple shown cards.** Re-list just the matches and ask for a number.
- **User picks a substring that matches none of the shown cards.** Search the full Todo column. If still no match, ask them to pick from the displayed list or pass a different substring.
- **Card already has assignees and the assignee isn't the user.** Surface it: "This card is assigned to @other-user. Take it anyway?"
- **Card body references files that don't exist.** Skip those silently in the file list — don't list ghost paths.
- **`--board-order` flag.** Skip Step 2 entirely. Show cards in raw column order without the scheme summary or "why" annotations. This is the old default — useful when the user has already curated the board and the ranking would just add noise.
- **`--auto` flag.** Skip Step 4's pick and Step 5's confirmation; take the rank-#1 card from the chosen scheme (or the first card in board order if `--board-order` was also passed), move it, dump. Useful for `/loop` style automation. Before the context dump, emit a single auditable log line so a later reviewer (or the next `/loop` tick) can see why this card was chosen:

  ```
  [gh-project next --auto] picked #51 "Fix flaky retry test" — scheme: milestone due date → priority → age — why: only p0 in v0.4 (due in 6d) (2 candidates demoted: #38 wontfix, #44 blocked)
  ```

  The line names: the issue/draft, the ranking scheme that was applied, the one-line "why" for this card, and a short note for any cards that were demoted or skipped. If `--board-order` was passed, the scheme is just `board order` and there's no "why" — the log still records the pick and any skipped cards (e.g. `wontfix`).
- **`gh issue list` fails or returns nothing useful.** If signals can't be fetched, fall back to board order silently and note "(ranking signals unavailable — using board order)" in the candidate list header.

## Guidelines

- **Rank contextually, not by a fixed formula.** Different projects organize work differently. Look at what signals are actually in use across the Todo column and adapt — don't invent a `phase` axis if only one card has a phase label, and don't sort by milestone if no milestone has a due date.
- **Board order is the tiebreaker, not the primary signal.** Within an equivalence class (same milestone, same priority), keep the user's manual column order. Pass `--board-order` to make it primary again.
- **Show your work.** Each candidate gets a one-line "why" so the user can sanity-check or override the algorithm with a substring pick.
- **One card per invocation.** Even if the user says "give me three", picking one at a time is the contract. Re-invoke for the next.
- **Stop at the context dump.** No branch creation, no edits, no planning conversation. The subcommand's job ends when the agent knows what the card is.
- **Don't reorder the board.** Ranking the display ≠ rearranging the board. The kanban itself stays untouched; the user can move cards manually on github.com if they want.
- **Respect the user's `--auto` for headless runs, but log the pick** so they can audit later.
