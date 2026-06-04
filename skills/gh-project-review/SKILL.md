---
name: gh-project-review
description: Audit the repo's GitHub Projects kanban against the codebase, identifying cards that look Done (code shipped) or look stuck (no movement). Presents each finding with code evidence and asks for one-by-one approval before updating the board. Use when the user says "review the board", "audit the kanban", "what's stale on the project", or "/gh-project-review".
---

# gh-project-review

You are auditing the repository's GitHub Projects kanban against the actual state of the codebase. The output is a structured conversation: for each card whose status looks wrong, you present **evidence from the code** and the user **approves or rejects each update individually**.

Treat this like a code review with verdicts. False positives are expensive — moving a card to Done when the work isn't actually shipped misleads everyone.

## When to use

- "review the board" / "audit the kanban" / "what's stale on the project"
- "check the project tasks"
- "/gh-project-review"

## Prerequisites

Read `.github/gh-project.json`. If missing, route to `/gh-project-setup`.

```bash
CONFIG=$(cat .github/gh-project.json)
PROJECT_NUMBER=$(echo "$CONFIG" | jq -r '.projectNumber')
PROJECT_ID=$(echo "$CONFIG" | jq -r '.projectId')
OWNER=$(echo "$CONFIG" | jq -r '.owner')
REPO=$(echo "$CONFIG" | jq -r '.repo')
STATUS_FIELD_ID=$(echo "$CONFIG" | jq -r '.statusField.id')
TODO_ID=$(echo "$CONFIG" | jq -r '.statusField.options.Todo')
IN_PROGRESS_ID=$(echo "$CONFIG" | jq -r '.statusField.options."In Progress"')
DONE_ID=$(echo "$CONFIG" | jq -r '.statusField.options.Done')
```

## Workflow

### 1. Pull the current board

```bash
gh project item-list "$PROJECT_NUMBER" --owner "$OWNER" --format json -L 200 > /tmp/board.json
```

The JSON shape per item:
```json
{
  "id": "PVTI_…",
  "title": "…",
  "status": "Todo" | "In Progress" | "Done" | "",
  "content": {
    "type": "DraftIssue" | "Issue" | "PullRequest",
    "id": "…",
    "title": "…",
    "body": "…",
    "url": "…"          // present for Issue / PullRequest
  }
}
```

By default, audit all cards NOT in `Done`. If the user asks for a narrower scope ("just In Progress", "just the 'docs' label"), filter accordingly.

### 2. Gather codebase evidence per card

For each candidate card, look for evidence that the work is done OR clearly not started. Use **multiple cheap signals** rather than one expensive deep dive:

| Signal | How to gather | What it suggests |
|--------|---------------|------------------|
| Recent commits matching the title | `git log --since="3 months ago" --grep="<keyword>" --oneline` | likely done if a recent commit message matches |
| PRs closing the issue | `gh pr list --state merged --search "<issue-number>"` | done if a merged PR references it |
| File or symbol from the body exists | `grep -r "<keyword>" --include="*.ts"` or `rg` | partially landed |
| File doesn't exist | as above, empty result | not started |
| Linked PRs on the card | `content.url` → `gh issue view <n> --json closedByPullRequestsReferences` | strongest signal of doneness for issues |
| Card is an Issue and closed | issue state via `gh issue view` | done — should be in Done column |

Spawn parallel `Explore` or `Bash` calls — don't audit cards one at a time sequentially.

### 3. Classify each card

Use these verdict categories (mirror `/review-code-reproduce`):

- **Looks Done** — strong evidence the work shipped (merged PR + matching commits + files exist). Propose move to `Done`.
- **Looks In Progress** — partial evidence (some files exist, recent commits but no merged PR, open PR linked). Propose move to `In Progress` if currently `Todo`; leave alone if already there.
- **Looks Stale** — in `In Progress` for a long time with no recent commits and no open PR. Propose either moving back to `Todo`, closing, or asking the user. Don't auto-move backwards without confirmation.
- **Cannot determine** — evidence is mixed or absent. Don't propose a change. Note what would clarify it.
- **No change needed** — status matches reality. Skip silently in the conversation; include in the final tally.

Resist the urge to default to "Looks Done" just because *something* in the repo matches the title. A button labeled "Export CSV" matching a card titled "CSV export" doesn't mean the export feature works.

### 4. One-by-one approval loop

For each card with a proposed change, present this and **stop**:

```markdown
### Card #<N> — "<title>"

**Current status:** <Todo|In Progress|Done|—>
**Proposed:** <Todo|In Progress|Done> (verdict: <Looks Done|...>)

**Body excerpt:**
> <first ~3 lines of card body, or "(no body)">

**Evidence:**
- <signal 1: e.g. "merged PR #234 'Implement CSV export' on 2026-04-10">
- <signal 2: e.g. "git log: 8 commits in src/export/ since card creation">
- <signal 3 with code reference: `src/export/csv.ts:42` exports `exportToCsv`>

**Approve this change?** (yes / no / skip / show more)
```

Show one card at a time. Don't batch. Wait for explicit user response before moving on.

Handle responses:
- **yes** → apply the update (next section), then move to the next card.
- **no** → record the rejection reason if the user gave one; move on. Don't argue.
- **skip** → leave as-is, move on; revisit at the end if requested.
- **show more** → dump more evidence (additional commit messages, file contents, linked PR diff).

### 5. Apply an approved update

For both drafts and issues, status moves are field updates on the item:

```bash
gh project item-edit \
  --id "$ITEM_ID" \
  --project-id "$PROJECT_ID" \
  --field-id "$STATUS_FIELD_ID" \
  --single-select-option-id "$TARGET_OPTION_ID"
```

`$ITEM_ID` is the `PVTI_…` from the item-list output; `$TARGET_OPTION_ID` is `$TODO_ID`, `$IN_PROGRESS_ID`, or `$DONE_ID` from the config.

If the card is an Issue (`content.type=="Issue"`) AND the verdict is `Looks Done` AND the issue is still open, also ask the user whether to close the underlying issue:

```bash
gh issue close <issue-number> --repo "$OWNER/$REPO" --comment "Closing per project board review — see <PR or commit reference>."
```

Don't auto-close issues; closing is user-visible and notifies subscribers.

### 6. Final tally

After all cards are reviewed:

```
Reviewed: N
  Moved to Done:        X
  Moved to In Progress: Y
  Moved to Todo:        Z
  Issues also closed:   K
  Skipped / rejected:   M
  No change needed:     P
```

If any cards were `Cannot determine`, list them with the missing info so the user can resolve manually.

## Guidelines

- **One card at a time in the approval loop.** Batching breaks the structured review the user asked for.
- **Quote the evidence.** "Looks done because something matched" is not enough. Cite the merged PR number, the commit SHA, or the file path.
- **Don't widen scope.** If reviewing surfaces a missing card (work clearly happened but no card exists), mention it at the end as a Bonus finding; do NOT create the card mid-review.
- **Don't close issues without explicit approval.** Status-on-board and issue-state are separate decisions.
- **Respect the user's "no".** A rejection means your evidence wasn't strong enough; don't re-litigate the same card.
- **Honor user feedback in CLAUDE.md.** If the project tracker section says "When an item is finished, move it to Done — do not delete it," obey that.
