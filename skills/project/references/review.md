# `/project review` — Audit the Board

You are auditing the repository's GitHub Projects kanban against the actual state of the codebase. The output is a structured conversation: for each card whose status looks wrong, you present **evidence from the code** and the user **approves or rejects each update individually**.

Treat this like a code review with verdicts. False positives are expensive — moving a card to Done when the work isn't actually shipped misleads everyone.

## When to use

- "review the board" / "audit the kanban" / "what's stale on the project"
- "check the project tasks"
- "/project review"

## Prerequisites

**Run the [backend guard](_guard.md) first.** It locates `.project/config.json`
(routing a legacy `.github/gh-project.json`, or an unconfigured repo, to
`/project setup`), confirms the **github** backend, and exports `$HELPER`
(`.project/scripts/board.sh`), `$REPO_OWNER`, and `$REPO`. Stop if the guard did.
The steps below assume the github backend; the `board.sh`/`gh` calls behind the
adapter verbs are documented in [backends/github.md](backends/github.md).

## Workflow

### 1. Pull the current board

Use the helper. It fetches up to 500 items, asserts `fetched == totalCount`, and outputs one compact JSON row per line:

```bash
# Cards not yet Done — most reviews want this.
$HELPER list --query "-status:Done" > /tmp/board.jsonl

# Or everything (rarely needed):
$HELPER list > /tmp/board.jsonl
```

Each row has the shape:
```json
{"id":"PVTI_…","title":"…","status":"Todo","type":"Issue","number":23,"url":"https://…","bodyPreview":"first 120 chars…"}
```

If the helper exits with `TRUNCATED: fetched N of M items`, the board is too big — narrow with `--query` (e.g. `--query "is:open -status:Done"`) before retrying.

Need the full body for a specific card? Use `$HELPER get <PVTI_…>` for that one card rather than re-fetching everything with `--include-body`.

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

Use these verdict categories (mirror `/review-code-repro`):

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

Use the helper — it looks up the field id and option id from the config so you can't mix them up:

```bash
$HELPER set-status "$ITEM_ID" "Done"          # or "Todo", "In Progress"
```

`$ITEM_ID` is the `.id` from the board JSONL row. The status name must match a key in `.statusField.options` in `.project/config.json` — the helper will list the valid options if you pass an unknown one.

If the card is an Issue (`content.type=="Issue"`) AND the verdict is `Looks Done` AND the issue is still open, also ask the user whether to close the underlying issue:

```bash
gh issue close <issue-number> --repo "$REPO_OWNER/$REPO" --comment "Closing per project board review — see <PR or commit reference>."
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
