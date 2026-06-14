---
name: decompose
description: Break a problem into smaller pieces — subsystems that are easier to think about — and show how they relate. Works on the current conversation by default, or on a focus passed after the command. Invoke via /decompose.
argument-hint: "[focus]"
disable-model-invocation: true
---

# Decompose

Break a problem into smaller pieces — subsystems that are easier to think about one at a time — and show how the pieces relate.

**Usage:** `/decompose [focus]`

Examples:
- `/decompose` — decompose whatever's currently being worked on in the conversation
- `/decompose "the cache invalidation logic"` — focus on a specific named piece
- `/decompose how should the new ingest pipeline be structured` — decompose a stated problem

## Input

Raw input: `$ARGUMENTS`

- **Empty** → decompose the active problem from the recent conversation turns.
- **Anything else** → use it as the focus. Still draw on the broader conversation for context.

## What makes a good decomposition

The user wants the problem broken into subsystems they can reason about independently. Aim for:

- **3–7 pieces.** Fewer means you haven't decomposed; more means you're listing tasks, not subsystems.
- **Each piece independently thinkable.** A reader should be able to hold one piece in their head and reason about it without simultaneously tracking the others.
- **Named, with a one-line description.** The name is a handle; the description says what the piece is responsible for.
- **Real seams.** Cut along boundaries that actually exist in the problem — data transformations, ownership boundaries, decisions that constrain other decisions — not arbitrary thirds.
- **Grounded.** When the problem involves code, cite `file:line` to anchor a piece to where it lives.

## Output format

Start with a single-line header:

`**Decompose ▸ <focus>**`

Then, in order:

1. **One-line restatement** of the problem in plain language. If the user's framing is already clear, paraphrase briefly — don't parrot.

2. **Pieces** — a numbered list. Each entry: a bold name, a dash, a one-line description of what the piece covers or is responsible for.

3. **How they connect** — a short bullet list of the relationships that matter: which pieces depend on which, what the critical path is, which pieces are independent and can be thought about (or deferred) separately, and which single piece constrains the others most.

## What NOT to do

- Don't fabricate pieces to pad out the list. If the problem genuinely has two parts, list two.
- Don't propose code changes or make edits. This is a thinking tool — if a code edit is the obvious next move, say so, but don't do it.
- Don't write a file artifact. Chat only, unless the user explicitly asks.
- If the problem is already small enough to think about whole, say so directly and name the next move. False structure is worse than no structure.
- Don't lecture or restate what the user already plainly knows.

## Follow-ups

Follow-ups are normal conversation. If the user asks about one of the pieces, just discuss it — or decompose it further in the same format if that's what they ask for. No special syntax.

## Tone

Concise. Concrete. The user wants a clearer map of the problem, not a textbook. When a piece is genuinely murky to you too, say so plainly — sometimes the decomposition's value is revealing which piece needs investigation first.
