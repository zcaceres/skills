# `/gh-project delete` — Remove a Card

You are removing a card from the GitHub Projects kanban board. **Confirmation is mandatory.** Deleting a draft destroys it; "deleting" an issue-backed card only unlinks the issue from the project (the issue itself persists unless the user separately closes/deletes it).

## When to use

- "/gh-project delete [id|number|title]"
- "delete card N" / "remove this task from the board"
- "drop the X card"

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

PROJECT_NUMBER=$(jq -r .projectNumber .github/gh-project.json)
PROJECT_OWNER=$(jq -r .projectOwner .github/gh-project.json)
REPO_OWNER=$(jq -r .repoOwner .github/gh-project.json)
REPO=$(jq -r .repo .github/gh-project.json)
```

## Step 1 — Resolve the target

Use the helper's `find` subcommand:

```bash
$HELPER find "$SELECTOR"   # auto-detects PVTI_… / issue# / title-substring
```

If the resolution returns more than one row, **list all candidates and ask the user to pick**. Do not delete the first match.

If the user invoked the subcommand bare (no identifier), **stop and ask**. Inferring deletion targets from conversation context is too risky.

## Step 2 — Show full card details

Pull everything visible about the card before asking for confirmation. The user needs to see exactly what they're about to lose.

```bash
$HELPER get "$ITEM_ID"        # full row with body
```

For issue-backed items, also pull the issue:
```bash
gh issue view <issue-number> --repo "$REPO_OWNER/$REPO" --json title,body,state,labels,milestone,comments,closedByPullRequestsReferences
```

Present:

```markdown
### About to delete card

**Item ID:** <PVTI_…>
**Type:** Draft | Issue #<n> | Pull Request #<n>
**Title:** <title>
**Status:** Todo | In Progress | Done
**Body:**
> <full body, or first ~20 lines if huge>

<for issues only:>
**Issue state:** open | closed
**Labels:** <…>
**Milestone:** <…>
**Linked PRs:** <…>
**Comments:** <count>
```

## Step 3 — Spell out what "delete" means here

This is the critical confirmation step. Show the **right** consequences for the card type:

### Draft card
```
This will DELETE the draft. The title, body, and history are not stored anywhere else and cannot be recovered.
```

### Issue-backed card
```
This will REMOVE the issue from the project board (unlink only).
The underlying issue #<n> at <url> will remain open and reachable on the Issues tab.
After unlinking, do you also want to:
  (a) close the issue
  (b) delete the issue entirely (destructive — requires admin perms)
  (c) leave the issue alone
```

### PR-backed card
```
This will REMOVE the PR from the project board (unlink only).
The PR itself is untouched.
```

## Step 4 — Confirm explicitly

Ask in plain language:

> Type **yes** to confirm deletion of "<title>" (<PVTI_…>).

Accept ONLY an affirmative response (`yes`, `y`, `confirm`, `delete it`). Treat anything else — even "ok" or silence — as a cancel.

For destructive secondary actions (closing or deleting the underlying issue), confirm those **separately** after the unlink.

## Step 5 — Apply

Removing the card from the project (works for both drafts and issue/PR items):

```bash
gh project item-delete "$PROJECT_NUMBER" \
  --owner "$PROJECT_OWNER" \
  --id "$ITEM_ID"
```

For drafts, this is total deletion. For issues/PRs, the underlying object is untouched.

If the user approved closing the underlying issue:
```bash
gh issue close <issue-number> --repo "$REPO_OWNER/$REPO" --comment "<short reason>"
```

If the user approved deleting the underlying issue (rare — admin-only):
```bash
gh issue delete <issue-number> --repo "$REPO_OWNER/$REPO" --yes
```

`gh issue delete --yes` permanently destroys the issue and all its comments. Do not run it unless the user typed yes a **second** time after seeing the consequence laid out.

## Step 6 — Report

```
Removed card "<title>" (<PVTI_…>) from the board.
  Type:        Draft | Issue #<n> | PR #<n>
  Underlying: deleted | closed | left open | n/a
```

If anything failed mid-sequence (unlink succeeded but issue close failed, etc.), say so explicitly. Don't claim a full success when only part of it landed.

## Edge cases

- **Card title in the user's prompt doesn't match exactly.** Resolve via substring match (above) and confirm the candidate before proceeding. Never assume the closest match is correct.
- **User insists on deleting without seeing details.** Still show the title and item id at minimum. Skipping confirmation entirely is not safe.
- **Card is on multiple projects.** `item-delete` only removes it from the target project. The card may still be tracked elsewhere — surface that for issue/PR cards.
- **User cancels at any step.** Stop completely. Don't partial-apply. Don't propose a "softer" version.
- **The issue has unmerged work tied to it.** If the issue has open PRs referencing it, mention them before confirming.

## Guidelines

- **Confirm first, every time.** Even if the user typed `/gh-project delete 23` and seems decisive — the show-and-confirm step is the value-add of this subcommand.
- **Don't infer the target from conversation context.** Require an explicit identifier. Unlike `/gh-project update` (where the worst case is overwriting recoverable text), a wrong delete here can destroy data.
- **One card per invocation.** No bulk deletes. If the user wants to clear out five cards, do them sequentially with five confirmations.
- **Respect the project tracker norms.** This repo's CLAUDE.md says "When an item is finished, move it to Done — do not delete it." If the user invokes delete on a Done-looking card, push back: would they rather move it to Done?
- **Never `--no-verify`-equivalent shortcuts.** No silent flags to skip confirmation. The whole point of this subcommand is the confirmation gate.
