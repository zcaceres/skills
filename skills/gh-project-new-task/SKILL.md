---
name: gh-project-new-task
description: Create a new card on the repo's GitHub Projects kanban. By default creates a real GitHub issue linked to the project; can opt into a project-only draft. Supports an optional milestone. Use when the user says "new task", "add a card", "create a project task", or "/gh-project-new-task".
---

# gh-project-new-task

You are creating a new card on the repository's GitHub Projects kanban board.

## When to use

- "new task" / "add a card" / "create a project task"
- "/gh-project-new-task <title>"
- The user describes work and asks to track it on the board

## Inputs

| Input | Source | Required |
|-------|--------|----------|
| Title | user prompt or ask | yes |
| Body | user prompt or ask | yes (can be empty for trivial cards, but prefer at least a sentence) |
| Mode | `issue` (default) or `draft` | no |
| Milestone | repo milestone name | no — issues only |
| Labels | comma-separated label names | no — issues only |
| Assignees | gh logins, `@me`, `@copilot` | no — issues only |

If the user invoked `/gh-project-new-task` with arguments, parse the title from the args; ask for any missing fields. If they invoked it bare, ask for title and body.

## Prerequisites

Read `.github/gh-project.json`. If it doesn't exist, stop and tell the user to run `/gh-project-setup` first. Don't try to guess the project number.

```bash
CONFIG=$(cat .github/gh-project.json)
PROJECT_NUMBER=$(echo "$CONFIG" | jq -r '.projectNumber')
OWNER=$(echo "$CONFIG" | jq -r '.owner')
REPO=$(echo "$CONFIG" | jq -r '.repo')
TITLE_FIELD=$(echo "$CONFIG" | jq -r '.title')
DEFAULT_MODE=$(echo "$CONFIG" | jq -r '.defaultMode')
```

## Mode A — Real GitHub issue (default)

Issues are visible on the Issues tab, support assignees/labels/milestones, and can be referenced from PR descriptions with `Fixes #N`.

```bash
gh issue create \
  --repo "$OWNER/$REPO" \
  --title "$CARD_TITLE" \
  --body "$CARD_BODY" \
  --project "$TITLE_FIELD" \
  ${MILESTONE:+--milestone="$MILESTONE"} \
  ${LABELS:+--label="$LABELS"} \
  ${ASSIGNEES:+--assignee="$ASSIGNEES"}
```

Notes:
- `--project "$TITLE_FIELD"` takes the project **title**, not the number.
- Multiple labels: pass `--label` repeatedly or comma-separated in one flag.
- `gh issue create` prints the new issue URL. Capture it.
- The card lands in the default Status column (`Todo`).

If the user passed an unknown milestone, `gh` errors out — re-fetch valid milestones and offer them:

```bash
gh api "repos/$OWNER/$REPO/milestones" --jq '.[] | "\(.number)\t\(.title)\t\(.state)"'
```

To create a milestone first (only if the user confirms):

```bash
gh api "repos/$OWNER/$REPO/milestones" -f title="$MILESTONE" -f state=open
```

## Mode B — Draft (project-only)

Drafts live on the board and nowhere else. Use when the user explicitly asks for a draft, or when `defaultMode` is `draft` in the config.

```bash
gh project item-create "$PROJECT_NUMBER" \
  --owner "$OWNER" \
  --title "$CARD_TITLE" \
  --body "$CARD_BODY" \
  --format json
```

Captures: `.id` (the `PVTI_…` item ID), `.title`, `.body`.

Limitations to surface up front:
- Drafts do NOT support milestone, assignees, labels, or being referenced from PRs.
- If the user wants milestone tracking on this card, push them to issue mode.

## Setting initial status (optional)

Both modes land the card in `Todo`. If the user wants to start in `In Progress` (e.g. they're already working on it), use the shared helper:

```bash
# For a draft: .id is the PVTI_… from item-create.
# For an issue: find the project item id by issue number.
ITEM_ID=$(.github/scripts/gh-project-board.sh find "$ISSUE_NUMBER" | jq -r '.id')

.github/scripts/gh-project-board.sh set-status "$ITEM_ID" "In Progress"
```

If `.github/scripts/gh-project-board.sh` is missing (setup was run before this script existed), fall back to the raw command — but mention the gap to the user and offer to re-run `/gh-project-setup`:

```bash
PROJECT_ID=$(jq -r .projectId .github/gh-project.json)
STATUS_FIELD_ID=$(jq -r .statusField.id .github/gh-project.json)
IN_PROGRESS_ID=$(jq -r '.statusField.options["In Progress"]' .github/gh-project.json)

gh project item-edit \
  --id "$ITEM_ID" \
  --project-id "$PROJECT_ID" \
  --field-id "$STATUS_FIELD_ID" \
  --single-select-option-id "$IN_PROGRESS_ID"
```

Note: `gh project item-edit` for an issue-backed item only supports updating **one field per invocation** and requires `--project-id`. Drafts can be edited via `--id` alone.

## Output

After creating the card:

```
Created <issue|draft> card "<title>"
  URL:    <issue or project url>
  Item:   <PVTI_…>
  Status: Todo
  Mode:   issue | draft
  Milestone: <name or —>
```

Print the URL last so it's easy to click.

## Edge cases

- **No `.github/gh-project.json`.** Stop and route to `/gh-project-setup`. Do not attempt to guess the project number.
- **User invokes with `--draft` but config has `defaultMode: issue`.** Honor the flag. Don't write to the config — defaults stay sticky.
- **Title contains shell metacharacters.** Quote it as a single argument. Don't echo it through `eval`.
- **Issue creation succeeds but project linking fails.** `gh issue create --project` is atomic in normal cases; if it returns 0 but the card isn't on the board, fall back to `gh project item-add --url <issue-url>`.
- **User wants to attach a milestone to a draft.** Tell them drafts don't support milestones; offer to either (a) make it an issue instead, or (b) add a custom text field via `gh project field-create` and store the milestone name there.

## Guidelines

- Don't silently change `defaultMode`. If the user wants the default flipped, suggest re-running `/gh-project-setup`.
- Confirm the title and body before invoking the create command — these are user-visible and a typo means an awkward edit later.
- Don't create more than one card per invocation. If the user lists multiple, ask whether to make them sub-issues, separate cards, or batch in a follow-up.
