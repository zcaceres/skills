---
name: decompose
description: Break a stuck problem into tractable pieces by diagnosing the kind of stuck (opacity, paralysis, bug fog, scope, concept fuzz, design uncertainty) and applying 1-3 lenses. Invoke via /decompose.
argument-hint: "[focus | branch-number]"
disable-model-invocation: true
---

# Decompose

Break a problem you're stuck on into smaller, more tractable pieces — by diagnosing what kind of stuck you're in and applying the right lens(es).

**Usage:** `/decompose [focus]`

Examples:
- `/decompose` — decompose whatever's currently in the conversation
- `/decompose "the cache invalidation logic"` — focus on a specific named piece
- `/decompose why this test is flaky` — narrow to one question
- `/decompose 2` — drill into branch 2 from the most recent decomposition

## When to use

The user has invoked this because they're stuck. Not stuck-as-in-blocked-on-a-tool — stuck-as-in their mental model isn't strong enough to make the next move with confidence. Your job is to give them a foothold.

Don't decompose for the sake of decomposing. If the path forward is already obvious from the conversation, say so directly and name the next step. False structure wastes attention.

## Diagnose the stuck

Read the recent conversation and identify which of these is happening. They overlap — pick the one or two that fit best.

- **Opacity** — there's a system, file, or behavior the user genuinely doesn't understand
- **Paralysis** — multiple plausible options, no obvious tiebreaker
- **Bug fog** — something's broken, cause unclear, can't bisect
- **Scope** — the task is too big to hold in one head; no obvious starting point
- **Concept fuzz** — terms or abstractions are being used but not really understood
- **Design uncertainty** — building something new; the shape isn't obvious

Name the diagnosis in the header (see Output format). One short phrase.

## Lens library

Pick **1–3** lenses that fit the diagnosis. Don't pull all of them; the goal is leverage, not exhaustiveness.

- **Known / Assumed / Unknown ledger** — sort the situation into three buckets: what's verified, what's believed but not verified, what's actually unknown. Surfaces hidden assumptions. Good for opacity, concept fuzz, bug fog.

- **Sub-problem tree with critical path** — break the task into smaller problems with their dependencies, then mark which is on the critical path and which can wait. Good for scope.

- **Smallest next experiment** — what's the cheapest concrete action that would produce new information and reduce uncertainty? Good for paralysis and bug fog. Bias toward something the user can do in under 30 minutes.

- **First-principles restatement** — strip the problem to its actual requirement. What is *literally* being asked? What's the simplest thing that would satisfy it? Good for design uncertainty and tangled solutions.

- **Trace** — follow the data or control flow start to finish, naming each transformation and where state lives. Good for opacity and bug fog. Cite `file:line` as you go.

- **Analogy / prior art** — what's a similar problem the codebase, the team, or the user has already solved? What can be borrowed? Good for design uncertainty.

- **Binding constraint** — what's the *actually* limiting thing here? Correctness? Performance? A specific edge case? An unknown? Naming the binding constraint often dissolves false constraints. Good for paralysis.

## Parsing `$ARGUMENTS`

Raw input: `$ARGUMENTS`

Parse rules, in order:
1. **Empty** → decompose the active problem from the most recent conversation turns.
2. **Bare integer** (`2`, `3`) → drill into that numbered branch from the most recent decomposition in this conversation. If there's no prior decomposition, treat the integer as a literal focus.
3. **Quoted string** → use as the literal focus.
4. **Free text** → use as the focus.

When a focus is given, narrow the decomposition to that subject — but still draw on the broader conversation for context.

## Output format

Start your reply with a single-line header:

`**Decompose ▸ <diagnosis> · <focus-if-any>**`

Examples:
- `**Decompose ▸ opacity in the cache layer**`
- `**Decompose ▸ paralysis · which validation library**`
- `**Decompose ▸ scope · ship the new ingest pipeline**`
- `**Decompose ▸ bug fog · flaky auth test**`

Append ` · drill-down` when continuing from a numbered branch.

After the header, in order:

1. **One-line restatement** of the problem in plain language. If the user's framing is already clear, paraphrase briefly — don't parrot.

2. **Lenses** (1–3, each as a `### <Lens name>` section). Be concrete. Cite `file:line` when grounding a claim about code. Use bullet lists for enumerations; short prose for flows.

3. **Next moves** — a numbered list of 2–4 concrete options. Mix:
   - The single smallest concrete action that would unblock progress
   - Drill-downs into specific branches worth exploring
   - A clarifying question, if there's a key piece of context that would change the picture

End with: *"Reply with a number, a name, or a question."*

## Drill-down flow

When the user replies with a bare number, a sub-problem name, or a follow-up question, that's continuation. Re-diagnose (the new focus may be a different kind of stuck than the parent), pick lenses, output in the same format. The header should reflect the narrower focus.

No special syntax for resumption — natural conversation is the interface.

## What NOT to do

- Don't restate what the user already plainly knows.
- Don't fabricate sub-problems to pad out a tree.
- Don't pull every lens — pick 1–3 that fit.
- Don't propose code changes or make edits. This is a thinking tool. If a code edit is the obvious next move, name it under **Next moves** — don't do it.
- Don't write a file artifact. Chat only, unless the user explicitly asks.
- If the problem is genuinely simple and doesn't need decomposing, say so directly and offer the next move. False structure is worse than no structure.
- Don't lecture. The user is stuck on *this* problem, not unfamiliar with the topic in general.

## Tone

Concise. Concrete. Useful. The user is stuck — they need a foothold, not a textbook. Walk through specific examples when it helps. Cite `file:line` when grounding claims about code. When you don't know something the user is also unsure about, say so plainly — sometimes the right decomposition reveals that the real next move is to find out.
