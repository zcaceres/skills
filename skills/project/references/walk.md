# `/project walk` — Groom a Scope One Card at a Time

Walk an explicit set of board cards in a tight loop. Show every card in the
scope, recommend the smallest useful action, wait for the user, apply the choice,
and advance.

Use `/project audit` instead when the goal is to find only cards whose board
status likely disagrees with the codebase. Use `walk` when the user wants to see
and groom every card in a milestone, column, label, or other scope.

## Prerequisite

Run the [backend guard](_guard.md). Stop if it routes to setup. Use the selected
backend's adapter verbs; github uses `$HELPER`, while linear uses its MCP tools.

## 1. Resolve and confirm the scope

Interpret the user's natural-language scope:

- milestone → its open board cards
- column, label, state, or issue type → the corresponding backend filter
- no scope → every card not Done
- ambiguous scope → list interpretations and ask; never guess

Keep the backend query internal. Preserve board or milestone order unless the
user asks for urgent-first ordering; then reuse [next.md](next.md)'s ranking
judgment. Treat the resulting list as a snapshot for the whole walk.

Announce the description and count before starting:

```text
Walking N cards in <scope>. Changes apply as you go; q stops anytime.
```

If the default, unscoped list exceeds 25 cards, offer to narrow it before
continuing. Stop immediately for an empty scope.

Fetch only the fields needed for the card: id, title, status, type, number, URL,
body preview, labels, milestone, age, and linked PR. On github, join `$HELPER
list --query "<q>"` with one `gh issue list` call for issue metadata. Fetch the
full body only when the user chooses `details`.

## 2. Form the suggestion

Before displaying each card, gather lightweight evidence for that card only.
Reuse `/project audit`'s evidence sources from
[audit.md](audit.md#2-gather-codebase-evidence-per-card): matching commits,
merged or linked PRs, issue state, and referenced files or symbols. Do not
prefetch future cards or show asynchronous `(gathering…)` state.

Recommend the smallest warranted action and include the strongest reason:

- `move to Done` when strong evidence says the work shipped
- `move to In Progress` when meaningful work or an open PR exists
- `move to Todo` or `Cancelled` when clear evidence supports it
- `update card — <specific change>` when its premise or description drifted
- `keep as-is` when its state matches the evidence or evidence is inconclusive

Never suggest deletion. If codebase checking is unavailable or the user disabled
it, suggest `keep as-is` and say why. A suggestion is a default, never an
automatic action.

## 3. Show one concise card

```markdown
── [i/N] ────────────────────────────────────────────
**"<title>"** · <Issue #n | Draft> · <Status>
<age> old · milestone: <name or —> · labels: <csv or —>
Suggested: <action> — <one strongest reason>

> <first ~2 lines / ~200 chars, or "(no body)">

**[Enter]** accept  **[s]** status  **[u]** update  **[k]** keep  **[m]** more  **[q]** quit
```

Keep the card to one screen. The URL and full evidence belong under `details`.

## 4. Apply the decision

Primary actions:

| Input | Behavior |
|---|---|
| `Enter` / `accept` | Accept the displayed suggestion. Status and keep actions apply immediately. For a suggested card edit, show the exact proposed diff and retain [update.md](update.md)'s approval gate. |
| `s` / `status [target]` | Choose another canonical status; prompt for the target when omitted. |
| `u` / `update` | Run [update.md](update.md)'s per-card workflow, including preview and approval. |
| `k` / `keep` | Leave the card unchanged and advance. |
| `m` / `more` | Show the secondary menu and remain on this card. |
| `q` / `quit` | Stop and print the tally. |

Secondary menu:

```text
details · comment · milestone · delete
[b] back
```

- `details`: show the URL, full body, full evidence, linked PRs, and latest
  comment summary; then return to the primary menu.
- `comment`: prompt for text and add it. Drafts require conversion to an issue.
- `milestone`: reuse [milestone.md](milestone.md) `add`. Github drafts require
  conversion to an issue.
- `delete`: reuse [delete.md](delete.md), including consequences and typed `yes`.
  Push back once and offer Done when the card appears finished.
- `b`: return to the primary menu.

Run `/project decompose <card>` separately; it is a substantial workflow and is
not part of the walk menu.

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
- Enter always accepts the visible suggestion; it is never an implicit skip.
- Never accept deletion through Enter.
- Status moves are direct. Card edits retain update's approval gate, and deletes
  retain delete's typed-`yes` gate.
- A status change may move a card outside the original filter; continue through
  the loaded snapshot without refetching.
- Drafts cannot receive comments or milestones. Explain the limitation rather
  than silently doing nothing.
- Before posting public comments or edits, flag sensitive conversation content.
- Convert relative dates to absolute dates before writing them to a card.
