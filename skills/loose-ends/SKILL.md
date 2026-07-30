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

## Scan

Read the whole conversation. Look for:

- defects mentioned but not fixed;
- choices deferred or made implicitly without surfacing the tradeoff;
- acknowledged shortcuts, dropped nits, and TODOs;
- dependencies or conflicts with other work that were not acted on or tracked;
- assumptions that the conversation relied on without checking;
- commitments that the assistant or user made but did not complete.

These are search prompts, not output categories. A candidate belongs in the
report only when it is both unresolved and plausibly action-worthy.

Re-read the later conversation first so you do not report something quietly
handled afterward. Verify against the current code only when the claim is
concrete, local, and cheap to check. If it would require a broader investigation,
keep the item only when it still matters and mark it `[unsure]`.

Skip rhetorical asides, rejected ideas, and work already captured in a ticket or
clearly intentional tracked TODO. Prefer a short, high-signal list. If nothing
qualifies, say so plainly.

## Output format

Return one ranked list, most actionable first. Keep each item to one sentence:
what remains unresolved, plus where when a useful `file:line`, commit, PR, or
ticket exists. Do not propose fixes.

```markdown
## Loose ends

- Empty-input path still dereferences `value.trim()` before the null check —
  flagged mid-session, never patched. `src/ui/Input.tsx:42`
- [unsure] Timezone handling in the export may double-apply the offset — raised,
  not confirmed either way.
- Chose in-memory caching without surfacing the Redis option to you — worth a
  yes/no before this ships.
- Depends on the auth refactor in PR #214 landing first; not tracked anywhere.
- Said a regression test would be added for the retry fix — none written.

5 loose ends.
```

Rules:
- Use `[unsure]` only when useful to show that the item could not be confirmed.
- Stay concrete: "Error handling could be better" is noise; "The `parse()` path
  swallows a `SyntaxError` we said we'd surface" is a loose end.
- End with `N loose ends.` Do not add categories or an area count.
- Report only. Never edit code or open issues as part of this skill.
