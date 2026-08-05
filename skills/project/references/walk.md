# `/project walk` — Groom a Scope One Card at a Time

Walk every card in a selected scope, one at a time. Show a concise card,
recommend a status or keeping it unchanged, wait for the user, apply the choice,
and advance.

Use `/project audit` instead to find only cards whose board status likely
disagrees with the codebase.

## Prerequisite

Run the [backend guard](_guard.md). Stop if it routes to setup. Use the selected
backend's adapter verbs; github uses `$HELPER`, while linear uses its MCP tools.

## 1. Resolve and confirm the scope

Support these natural-language scopes only:

- milestone → its open board cards
- status or column → cards in that status
- label → cards with that label
- no scope → every card not Done

If the request could match more than one supported scope, list the
interpretations and ask. If it asks for another scope type, explain the supported
choices rather than inventing a query.

Preserve milestone order for milestone scopes and board order for every other
scope. Do not rank or reorder cards. Treat the resulting list as a snapshot for
the whole walk.

Announce the description and count before starting:

```text
Walking N cards in <scope>. Changes apply as you go; q stops anytime.
```

If the default, unscoped list exceeds 25 cards, offer to narrow it. Stop for an
empty scope.

Fetch only the fields needed for the card: id, title, status, type, number, URL,
body preview, labels, milestone, age, and linked PR. On github, join `$HELPER
list --query "<q>"` with one `gh issue list` call for issue metadata. Fetch the
full body only for `details` or `update`.

## 2. Form the suggestion

Before displaying each card, gather lightweight evidence for that card only.
Reuse `/project audit`'s evidence sources from
[audit.md](audit.md#2-gather-codebase-evidence-per-card): matching commits,
merged or linked PRs, issue state, and referenced files or symbols. Do not
prefetch future cards.

Suggest only one of these actions, with the strongest reason:

- `move to Done`
- `move to In Progress`
- `move to Todo`
- `move to Cancelled`
- `keep as-is`

Never suggest editing or deleting a card. If its description appears stale,
suggest the appropriate status or `keep as-is` and mention that `u` can update
the card. If evidence is unavailable or inconclusive, suggest `keep as-is` and
say why. A suggestion is a default, never an automatic action.

## 3. Show one concise card

```markdown
── [i/N] ────────────────────────────────────────────
**"<title>"** · <Issue #n | Draft> · <Status>
<age> old · milestone: <name or —> · labels: <csv or —>
Suggested: <status action | keep as-is> — <one strongest reason>

> <first ~2 lines / ~200 chars, or "(no body)">

**[a]** apply suggestion  **[s]** status  **[u]** update  **[k]** keep  **[d]** details  **[x]** delete  **[q]** quit
```

Keep the card to one screen. The URL and full evidence belong under `details`.

## 4. Apply the decision

| Input | Behavior |
|---|---|
| `a` / `apply` | Apply the displayed status suggestion, or advance unchanged for `keep as-is`. |
| `s` / `status [target]` | Choose another canonical status; prompt for the target when omitted. |
| `u` / `update` | Run [update.md](update.md)'s per-card workflow, including preview and approval. |
| `k` / `keep` | Leave the card unchanged and advance. |
| `d` / `details` | Show the URL, full body, full evidence, linked PRs, and latest comment summary; remain on this card. |
| `x` / `delete` | Run [delete.md](delete.md), including its consequences and typed `yes` gate. Push back once and offer Done when the card appears finished. |
| `q` / `quit` | Stop and print the tally. |

Run `/project milestone add` or `/project decompose` separately; neither is part
of the walk loop.

After a successful action, print one result line and advance. If an action fails,
report the error and remain on the card for retry, keep, or quit. Stop the entire
walk only for systemic failures such as lost authentication or an unreachable
board.

## 5. Summarize

```text
Walked M/N cards
Changed A · Kept B · Deleted C · Remaining D
```

If stopped early, name the next card. There is no persistent cursor; rerunning
starts from the beginning of the selected scope.

## Safety and edge cases

- One card is visible at a time; never pre-render the scope.
- `a` always accepts the visible suggestion; it is never an implicit skip.
  Never assign an action to Enter: chat interfaces require a submitted message.
- Suggestions are status-or-keep only. Never accept editing or deletion through
  `a`.
- Status moves are direct. Card edits retain update's approval gate, and deletes
  retain delete's typed-`yes` gate.
- A status change may move a card outside the original filter; continue through
  the loaded snapshot without refetching.
- Before posting public edits, flag sensitive conversation content.
- Convert relative dates to absolute dates before writing them to a card.
