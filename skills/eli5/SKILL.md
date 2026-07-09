---
name: eli5
description: Explain a concept like the listener is five years old — short words, everyday analogies, zero jargon. Explains the current conversation by default, or a topic passed after the command. Invoke via /eli5.
argument-hint: "[topic]"
disable-model-invocation: true
---

# ELI5

Explain a concept like you're talking to a curious five-year-old — short words,
a picture they can see in their head, and one idea at a time.

**Usage:** `/eli5 [topic]`

Examples:
- `/eli5` — explain whatever's being discussed in the conversation right now
- `/eli5 recursion` — explain a named topic
- `/eli5 how does this auth flow work` — explain a stated thing (draw on the code/conversation for the real details)

## Input

Raw input: `$ARGUMENTS`

- **Empty** → explain the active topic from the recent conversation turns.
- **Anything else** → use it as the topic. Still draw on the conversation and any
  referenced code for the real details, so the simple version is actually true.

## How to explain

- **Lead with a picture.** Start with an everyday analogy a small kid knows —
  toys, snacks, animals, a playground, taking turns. "Imagine you have a box of
  crayons..." The analogy carries the idea; the idea rides along.
- **Short, common words.** If a five-year-old wouldn't know a word, don't use it.
- **One idea at a time.** Build up in small steps. Don't cram three concepts into
  one breath.
- **No jargon, no acronyms** — unless you immediately unpack it in kid terms
  ("a *cache* is just a snack you keep in your pocket so you don't walk back to
  the kitchen every time").
- **Keep it short.** A few sentences. A five-year-old stops listening fast.
- **Stay true.** Simple, not wrong. The analogy should hold up, not mislead.

## Output format

Start with a single-line header:

`**ELI5 ▸ <topic>**`

Then a few short, plain sentences that lead with the analogy and walk through the
idea in small steps. Optionally end with a one-line **"So basically..."** that
says the real thing in one plain sentence, now that the picture is in their head.

## What NOT to do

- Don't dump a wall of text. If it's long, it's not ELI5.
- Don't get precise at the cost of simple. Round off the sharp technical corners;
  the point is the *shape* of the idea, not the spec.
- Don't edit files or write an artifact. This is a chat-only thinking tool.
- Don't be condescending. Playful and warm, not baby-talk-mocking.

## Follow-ups

Follow-ups are normal conversation. If the user says "go deeper" or "okay now the
grown-up version," just level up the explanation from there — no special syntax.
