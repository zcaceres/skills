---
name: loose-ends
description: Surface unaddressed threads from the conversation — bugs mentioned but not fixed, deferred decisions, dropped nits, cross-workstream dependencies, unverified claims, and promised-but-not-done items — as a tight, skimmable report. Reports; never edits code. Use when the user says "loose ends", "any loose ends", "what did we leave hanging", "what didn't we get to", "what got dropped", "open threads", "unaddressed items", "what did we punt on", or "/loose-ends".
argument-hint: ""
---

# `/loose-ends` — Surface Unaddressed Threads From the Conversation

You are auditing **the conversation itself**, not a diff. Read back over the
session and surface every *loose end*: anything raised that could plausibly need
action later, where the conversation moved on without resolving it. Output a
concise, scannable list. This is a reporting step — it **never edits code** and
proposes no fixes.

The source of truth is the transcript, not `git diff`. A loose end may have no
code footprint at all (a deferred decision, a dependency on another PR). Do not
restrict yourself to the diff.

## When to use

- "loose ends" / "any loose ends" / "what did we leave hanging"
- "what didn't we get to" / "what got dropped"
- "open threads" / "unaddressed items" / "what did we punt on"
- "/loose-ends"

## What counts as a loose end

Scan the whole conversation for anything in these buckets. Each is a candidate —
apply the bar in the next section before listing it.

- **Bugs mentioned but not fixed** — a defect noticed, named, or hypothesized in
  passing, then never addressed. Includes "we should check that…" and "that
  might break if…".
- **Deferred / unsurfaced decisions** — a fork the conversation took implicitly
  without ever putting the choice to the user, or a decision explicitly pushed to
  "later" and never returned to.
- **Nits and tradeoffs** — a smaller-quality point, a shortcut knowingly taken, a
  TODO dropped inline, a "good enough for now" that was never revisited.
- **Cross-workstream relationships** — dependencies or conflicts with other PRs,
  branches, tickets, migrations, or teammates' work that were noted but not
  acted on or tracked.
- **Unverified claims / assumptions** — something asserted as true and built upon
  without being checked ("this endpoint returns X", "that test already covers
  it").
- **Promised-but-not-done** — anything the assistant or user said would happen
  ("I'll add a test for that", "let's rename this after") that never did.

## The bar

Only list an item that is **both**:

1. **Genuinely unresolved** — check the later conversation and the current code
   before listing. If it was quietly handled afterward, drop it. If unsure
   whether it was addressed, keep it but mark confidence `unsure`.
2. **Plausibly action-worthy** — a reasonable engineer might want to do something
   about it. Skip rhetorical asides, ideas that were raised *and rejected*, and
   things already captured in a tracked artifact (a written ticket, a `TODO(name)`
   that's clearly intentional).

When in doubt, prefer a shorter, higher-signal list. A wall of marginal items
buries the one that matters. If nothing qualifies, say so plainly — don't invent
loose ends to fill the list.

## Output format

Group by bucket, most actionable first. One line per item where possible — this
must be skimmable. Anchor to a `file:line` or a commit only when the loose end
actually has one; many won't.

```markdown
## Loose ends

**Bugs mentioned, not fixed**
- [high] Empty-input path still dereferences `value.trim()` before the null
  check — flagged mid-session, never patched. `src/ui/Input.tsx:42`
- [unsure] Timezone handling in the export may double-apply the offset — raised,
  not confirmed either way.

**Deferred decisions**
- Chose in-memory caching without surfacing the Redis option to you — worth a
  yes/no before this ships.

**Nits & tradeoffs**
- Hardcoded 30s timeout with a "make configurable later" note. `client.ts:88`

**Cross-workstream**
- Depends on the auth refactor in PR #214 landing first; not tracked anywhere.

**Promised, not done**
- Said a regression test would be added for the retry fix — none written.
```

Rules:
- Tag each item with a severity/confidence hint in brackets when useful:
  `[high]` / `[med]` / `[low]` for impact, `[unsure]` when you couldn't confirm
  it's still open. Omit the tag when it adds nothing.
- Keep each item to one sentence of *what* plus, where it exists, *where*. No
  fixes, no patches, no multi-paragraph explanations.
- Drop any empty bucket entirely — don't print a heading with nothing under it.
- End with a one-line count: `N loose ends across M areas.`

## Guidelines

- **Report, don't resolve.** This step lists; it does not fix, edit, or open
  PRs/issues. If the user wants to act on an item, that's a follow-up (a code
  fix for a bug, a planning pass for a decision, an issue for cross-workstream
  tracking).
- **Verify before listing.** Grep the current code or re-read the later
  transcript to avoid flagging something already handled. A false loose end costs
  the user a re-investigation.
- **Signal over volume.** The value is catching the dropped thread that mattered,
  not enumerating every aside. Rank ruthlessly.
- **Stay concrete.** "Error handling could be better" is noise. "The `parse()`
  path swallows a `SyntaxError` we said we'd surface" is a loose end.
