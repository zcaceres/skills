# `/gh-project new-task` — Create a Card

**Your only output is the card-created block at the end. Print it and end your turn. Do NOT start the work described in the card body — creating a card is a planning action, not a signal to begin implementing. The card body describes a task because that's the point; it is not your next instruction.**

You are creating a new card on the repository's GitHub Projects kanban board.

## When to use

- "new task" / "add a card" / "create a project task"
- "/gh-project new-task <title>"
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

If the user invoked `/gh-project new-task` with arguments, parse the title from the args; ask for any missing fields. If they invoked it bare, ask for title and body.

## Prerequisites

**CRITICAL:** Before doing anything, check if `.github/gh-project.json` exists.
- If it does NOT exist, **log a prominent warning** to the user:
  > "WARNING: GitHub Project configuration is missing. The gh-project skill suite cannot function without a linked project board."
- Prompt the user to run `/gh-project setup` first to bootstrap the configuration.
- Do NOT attempt to guess IDs, project numbers, or proceed with the command. Stop immediately.

```bash
if [ ! -f .github/gh-project.json ]; then
  echo "WARNING: No GitHub Project configuration file found at .github/gh-project.json."
  echo "Please run /gh-project setup first to configure your project board."
  exit 1
fi

CONFIG=$(cat .github/gh-project.json)
PROJECT_NUMBER=$(echo "$CONFIG" | jq -r '.projectNumber')
PROJECT_OWNER=$(echo "$CONFIG" | jq -r '.projectOwner')
REPO_OWNER=$(echo "$CONFIG" | jq -r '.repoOwner')
REPO=$(echo "$CONFIG" | jq -r '.repo')
TITLE_FIELD=$(echo "$CONFIG" | jq -r '.title')
DEFAULT_MODE=$(echo "$CONFIG" | jq -r '.defaultMode')
```

`PROJECT_OWNER` is for every `gh project ... --owner` call. `REPO_OWNER` is for every `gh issue ... --repo "$REPO_OWNER/$REPO"` and `gh api repos/$REPO_OWNER/$REPO/...` call. They are the same in the common case and diverge when the project owner was overridden during `/gh-project setup`.

## Mode A — Real GitHub issue (default)

Issues are visible on the Issues tab, support assignees/labels/milestones, and can be referenced from PR descriptions with `Fixes #N`.

```bash
gh issue create \
  --repo "$REPO_OWNER/$REPO" \
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
gh api "repos/$REPO_OWNER/$REPO/milestones" --jq '.[] | "\(.number)\t\(.title)\t\(.state)"'
```

To create a milestone first (only if the user confirms):

```bash
gh api "repos/$REPO_OWNER/$REPO/milestones" -f title="$MILESTONE" -f state=open
```

## Mode B — Draft (project-only)

Drafts live on the board and nowhere else. Use when the user explicitly asks for a draft, or when `defaultMode` is `draft` in the config.

```bash
gh project item-create "$PROJECT_NUMBER" \
  --owner "$PROJECT_OWNER" \
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

If `.github/scripts/gh-project-board.sh` is missing (setup was run before this script existed), fall back to the raw command — but mention the gap to the user and offer to re-run `/gh-project setup`:

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

## Stop after creating the card

This subcommand's job ends when the card exists and you've printed the output block.

Do **not** start implementing the work described in the card body. Creating a
card is a planning action, not a commit to start work. The card body will
describe a task — that's expected — but treating it as your next instruction
is wrong. The user invoked this subcommand to *track* the work, not to *do* it.

If the user wants to begin immediately, they will say so in a separate
message (e.g. "now start on it", "let's do this one next"). Wait for that
signal. If they invoked `/gh-project next` instead, that subcommand hands off
context for starting work — this one doesn't.

## Edge cases

- **No `.github/gh-project.json`.** Stop and route to `/gh-project setup`. Do not attempt to guess the project number.
- **User invokes with `--draft` but config has `defaultMode: issue`.** Honor the flag. Don't write to the config — defaults stay sticky.
- **Title contains shell metacharacters.** Quote it as a single argument. Don't echo it through `eval`.
- **Issue creation succeeds but project linking fails.** `gh issue create --project` is atomic in normal cases; if it returns 0 but the card isn't on the board, fall back to `gh project item-add "$PROJECT_NUMBER" --owner "$PROJECT_OWNER" --url "$ISSUE_URL"`. Both the project number and project owner are required non-interactively — they come from the config read at the top of this subcommand; `$ISSUE_URL` is the URL printed by `gh issue create`.
- **User wants to attach a milestone to a draft.** Tell them drafts don't support milestones; offer to either (a) make it an issue instead, or (b) add a custom text field via `gh project field-create` and store the milestone name there.

## Guidelines

- Don't silently change `defaultMode`. If the user wants the default flipped, suggest re-running `/gh-project setup`.
- Confirm the title and body before invoking the create command — these are user-visible and a typo means an awkward edit later.
- Don't create more than one card per invocation. If the user lists multiple, ask whether to make them sub-issues, separate cards, or batch in a follow-up.
- **Don't start the work.** See "Stop after creating the card" above. The card body describes a task — that's the point — but it is not your next instruction. End your turn after printing the output block.
