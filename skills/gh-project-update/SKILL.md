---
name: gh-project-update
description: Update an existing card on the repo's GitHub Projects kanban — title, body, or status — folding in context from the current conversation. Accepts an explicit card identifier (item id, issue number, or title) or infers the target card from conversation context. Use when the user says "update card 23", "add to that task", "/gh-project-update", or "/gh-project-update <id|title>".
---

# gh-project-update

You are updating a single card on the GitHub Projects kanban board with new findings, decisions, or context — usually drawn from the current conversation.

## When to use

- "/gh-project-update [id|number|title]"
- "update card N" / "update the X task with what we just learned"
- "add what we figured out to the project board"
- The user has been working with you and wants to record progress without breaking flow

## Prerequisites

Read `.github/gh-project.json`. If missing, route to `/gh-project-setup`.

```bash
CONFIG=$(cat .github/gh-project.json)
PROJECT_NUMBER=$(echo "$CONFIG" | jq -r '.projectNumber')
PROJECT_ID=$(echo "$CONFIG" | jq -r '.projectId')
OWNER=$(echo "$CONFIG" | jq -r '.owner')
REPO=$(echo "$CONFIG" | jq -r '.repo')
STATUS_FIELD_ID=$(echo "$CONFIG" | jq -r '.statusField.id')
```

## Step 1 — Identify the target card

Three possible inputs, in priority order:

### A. Explicit project item id (`PVTI_…`)
Use as-is. Skip lookup.

### B. Issue number or project card title
Resolve via `item-list`:

```bash
gh project item-list "$PROJECT_NUMBER" --owner "$OWNER" --format json -L 200 > /tmp/board.json
```

- **Issue number `23`** → match against `content.url` ending in `/issues/23`:
  ```bash
  jq -r --arg n "23" '.items[] | select(.content.url? | test("/issues/" + $n + "$")) | .id' /tmp/board.json
  ```
- **Title or substring** → case-insensitive substring match on `title`:
  ```bash
  jq -r --arg q "csv" '.items[] | select(.title | ascii_downcase | contains($q | ascii_downcase)) | "\(.id)\t\(.title)\t\(.status)"' /tmp/board.json
  ```
  If more than one matches, list them all and ask the user to pick. Do not silently update the first match.

### C. Infer from conversation
If the user invoked the skill bare ("update that card with what we just figured out"), you must guess. Strategy:

1. Pull the full board (above).
2. Identify keywords from the recent conversation — files touched, function names, feature nouns the user used.
3. Score each non-Done card by keyword overlap with title + body.
4. If the top match is unambiguously ahead of the next, present it with one-line evidence and confirm before editing.
5. If two or more cards score similarly, list the top 3 and ask which one.

**Never write to a card you guessed without explicit user confirmation.** The cost of editing the wrong card is high; the cost of one extra question is one keystroke.

## Step 2 — Show current state + proposed update

Fetch the card's current title, body, and status. For drafts, item-list already has the body. For issues:

```bash
gh issue view <issue-number> --repo "$OWNER/$REPO" --json title,body,state,milestone,labels
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
gh issue edit <issue-number> --repo "$OWNER/$REPO" --title "$NEW_TITLE"
gh issue edit <issue-number> --repo "$OWNER/$REPO" --body  "$NEW_BODY"
```

For long bodies, write to a temp file and use `--body-file`:
```bash
gh issue edit <issue-number> --repo "$OWNER/$REPO" --body-file /tmp/new-body.md
```

### Status (both card types)

```bash
TARGET_OPTION_ID=$(echo "$CONFIG" | jq -r '.statusField.options["In Progress"]')
gh project item-edit \
  --id "$ITEM_ID" \
  --project-id "$PROJECT_ID" \
  --field-id "$STATUS_FIELD_ID" \
  --single-select-option-id "$TARGET_OPTION_ID"
```

Pass the status option name exactly as it appears in `.github/gh-project.json` under `statusField.options`.

### Custom fields (e.g. a "Notes" text field)

```bash
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

- **Card not found.** Print the candidates you considered and ask the user to clarify. Don't create a new card from a `update` invocation — that's `/gh-project-new-task`.
- **Ambiguous match.** Two cards titled similarly is common. List, don't guess.
- **User asks to change milestone or labels on a draft.** Drafts don't support those — explain and offer to convert to an issue (this requires deleting the draft and creating an issue, which is `/gh-project-delete` + `/gh-project-new-task`; surface that path rather than doing it implicitly).
- **Body would be huge.** Project item bodies are markdown. Be careful with code blocks that contain backticks — fence with `~~~` if needed. Trim noisy context (tool output, stack traces) to the load-bearing parts.
- **Conversation context contains private/sensitive info.** Before writing it into a public repo's project board, flag it: "This includes <env vars / tokens / customer names> — strip before posting?"

## Guidelines

- **Default to appending, not replacing.** A card's body is a small running log; don't clobber prior context.
- **Convert relative dates to absolute** when writing into a card body. "Yesterday" rots; `2026-06-03` survives.
- **Don't change status as a side effect of a body update.** Status moves are explicit decisions; ask separately if it isn't clear.
- **Don't update more than one card per invocation.** If the user wants three cards updated, do them one at a time so each gets its own confirmation.
- **Strip command output noise.** A 200-line `npm test` log doesn't belong on a card; the conclusion does.
