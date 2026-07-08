# `/project update` — Update a Card

You are updating a single card on the GitHub Projects kanban board with new findings, decisions, or context — usually drawn from the current conversation.

## When to use

- "/project update [id|number|title]"
- "update card N" / "update the X task with what we just learned"
- "add what we figured out to the project board"
- The user has been working with you and wants to record progress without breaking flow

## Prerequisites

**Run the [backend guard](_guard.md) first.** It locates `.project/config.json`
(routing a legacy `.github/gh-project.json`, or an unconfigured repo, to
`/project setup`), confirms the **github** backend, and exports `$HELPER`
(`.project/scripts/board.sh`), `$REPO_OWNER`, and `$REPO`. Stop if the guard did.
The steps below assume the github backend; the `board.sh`/`gh` calls behind the
adapter verbs are documented in [backends/github.md](backends/github.md).

**Linear backend:** title/body/status via `update_issue`; "custom fields" map to
Linear natives (priority/estimate/cycle/project), not GitHub single-selects. See
[backends/linear.md](backends/linear.md#per-subcommand-divergences).

(This subcommand only talks to `gh issue` directly — the board helper handles all `gh project` calls — so only `REPO_OWNER` is needed here.)

## Step 1 — Identify the target card

Three possible inputs, in priority order. Use the helper's `find` subcommand — it auto-detects which kind of selector you passed.

### A. Explicit project item id (`PVTI_…`)
```bash
ROW=$($HELPER find "$ITEM_ID")
```

### B. Issue number or title substring
```bash
$HELPER find 23        # treats as issue number
$HELPER find "csv"     # treats as title substring (case-insensitive)
```

The helper outputs zero or more JSONL rows. If multiple match, **list them all and ask the user to pick** — do not silently update the first match.

### C. Infer from conversation
If the user invoked the subcommand bare ("update that card with what we just figured out"), you must guess. Strategy:

1. Pull the board: `$HELPER list > /tmp/board.jsonl`.
2. Identify keywords from the recent conversation — files touched, function names, feature nouns the user used.
3. Score each non-Done card by keyword overlap with title + bodyPreview.
4. If the top match is unambiguously ahead of the next, present it with one-line evidence and confirm before editing.
5. If two or more cards score similarly, list the top 3 and ask which one.

**Never write to a card you guessed without explicit user confirmation.** The cost of editing the wrong card is high; the cost of one extra question is one keystroke.

## Step 2 — Show current state + proposed update

Fetch the card's current title, body, and status:

```bash
$HELPER get "$ITEM_ID"   # includes body for both drafts and issue-backed cards
```

For issue-backed cards you may want richer issue metadata (labels, milestone, assignees) — fetch that separately:

```bash
gh issue view <issue-number> --repo "$REPO_OWNER/$REPO" --json title,body,state,milestone,labels
```

Present:

```markdown
### Updating card "<title>" (<PVTI_…>)

**Type:** Issue #<n> | Draft
**Current status:** Todo | In Progress | Done

**Current body:**
> <existing body, or "(empty)">

**Proposed update:**
- **Title:** <new title, or "(unchanged)">
- **Body:** <new body — show diff or appended section>
- **Status:** <new status, or "(unchanged)">

Apply? (yes / no / edit)
```

Default to **appending** new context rather than replacing the existing body. Use a clear section header like `### Update <YYYY-MM-DD>` so the trail of context is preserved. Replace only if the user explicitly asks.

Wait for explicit approval. If they say "edit", revise based on their input and re-confirm.

## Step 3 — Apply the update

The commands differ by card type and by what's being changed. **`gh project item-edit` for an issue-backed item updates ONE field per invocation and requires `--project-id`.** For drafts, it can update title/body directly via `--id`.

### Updating a draft

Title:
```bash
gh project item-edit --id "$ITEM_ID" --title "$NEW_TITLE"
```
Body:
```bash
gh project item-edit --id "$ITEM_ID" --body "$NEW_BODY"
```

### Updating an issue

The issue's title and body live on the issue, not the project item:
```bash
gh issue edit <issue-number> --repo "$REPO_OWNER/$REPO" --title "$NEW_TITLE"
gh issue edit <issue-number> --repo "$REPO_OWNER/$REPO" --body  "$NEW_BODY"
```

For long bodies, write to a temp file and use `--body-file`:
```bash
gh issue edit <issue-number> --repo "$REPO_OWNER/$REPO" --body-file /tmp/new-body.md
```

### Status (both card types)

```bash
$HELPER set-status "$ITEM_ID" "In Progress"
```

The helper looks up the field id and option id from `.project/config.json`. Pass the status name exactly as it appears under `statusField.options`. If you pass an unknown name, the helper prints the valid options.

### Custom fields (e.g. a "Notes" text field)

The helper only knows about Status. For other fields, drop to raw `gh`:

```bash
PROJECT_ID=$(jq -r .projectId .project/config.json)

gh project item-edit \
  --id "$ITEM_ID" \
  --project-id "$PROJECT_ID" \
  --field-id "$CUSTOM_FIELD_ID" \
  --text "value"          # or --number / --date / --single-select-option-id
```

Run a separate `item-edit` per field. They are not batchable.

## Step 4 — Confirm

```
Updated <title> (<PVTI_…>)
  Title:  <changed | unchanged>
  Body:   <appended | replaced | unchanged>
  Status: <new status | unchanged>
  URL:    <issue or project url>
```

If you ran multiple `item-edit` calls (e.g. body + status), report each result and stop on the first failure rather than continuing blindly.

## Edge cases

- **Card not found.** Print the candidates you considered and ask the user to clarify. Don't create a new card from a `update` invocation — that's `/project new-task`.
- **Ambiguous match.** Two cards titled similarly is common. List, don't guess.
- **User asks to change milestone or labels on a draft.** Drafts don't support those — explain and offer to convert to an issue (this requires deleting the draft and creating an issue, which is `/project delete` + `/project new-task`; surface that path rather than doing it implicitly).
- **Body would be huge.** Project item bodies are markdown. Be careful with code blocks that contain backticks — fence with `~~~` if needed. Trim noisy context (tool output, stack traces) to the load-bearing parts.
- **Conversation context contains private/sensitive info.** Before writing it into a public repo's project board, flag it: "This includes <env vars / tokens / customer names> — strip before posting?"

## Guidelines

- **Default to appending, not replacing.** A card's body is a small running log; don't clobber prior context.
- **Convert relative dates to absolute** when writing into a card body. "Yesterday" rots; `2026-06-03` survives.
- **Don't change status as a side effect of a body update.** Status moves are explicit decisions; ask separately if it isn't clear.
- **Don't update more than one card per invocation.** If the user wants three cards updated, do them one at a time so each gets its own confirmation.
- **Strip command output noise.** A 200-line `npm test` log doesn't belong on a card; the conclusion does.
