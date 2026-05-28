---
name: zoom
description: Shift the conversation's abstraction level — `in` for internals (function, block, expression) or `out` for context (file, module, subsystem, system). Invoke via /zoom in|out [target].
argument-hint: "in|out [target | rung | count]"
disable-model-invocation: true
---

# Zoom

Move the conversation deliberately along the abstraction ladder — `in` toward internals, or `out` toward relationships and context. The header on every reply announces the move so both sides stay synchronized about which rung is in focus.

**Usage:** `/zoom in|out [target | rung | count]`

Examples:
- `/zoom in` — shift one rung deeper from the current focus
- `/zoom in 2` — shift two rungs deeper
- `/zoom in function` — jump to the function rung
- `/zoom in authenticate` — shift one rung deeper, focused on `authenticate`
- `/zoom in function verifyJWT` — jump to function rung, focused on `verifyJWT`
- `/zoom in "the retry loop"` — shift deeper, focused on a named block
- `/zoom out` — shift one rung outward
- `/zoom out 2` — shift two rungs outward
- `/zoom out module` — jump to the module rung
- `/zoom out auth module` — jump to module rung, focused on `auth`
- `/zoom out "the payments flow"` — step out, focused on a named area

## The abstraction ladder

From most specific to most general:

1. **expression** — a single line, statement, or expression
2. **block** — a branch, loop body, try/catch, or named chunk
3. **function** — a single function or method
4. **file** / **class** — one source file or class
5. **module** — a package or directory
6. **subsystem** — a feature area (auth, billing, ingest)
7. **system** — the whole repo/product

Above the ladder, for non-code conversations: **product/domain** (feature scope, design intent, business logic, strategy). Zooming out from system steps here; zooming in from product/domain steps back into code.

Subsystem and module collapse in small codebases — don't fabricate a distinction that doesn't matter.

## Parsing `$ARGUMENTS`

Raw input: `$ARGUMENTS`

The **first token** must be `in` or `out` — this picks the direction. If neither is present, ask one short question instead of guessing.

After the direction token, parse the rest in order:
1. **Empty** → shift 1 rung in the chosen direction from the current level.
2. **Leading bare integer** (`2`, `3`) → shift that many rungs in the chosen direction. Any trailing tokens are a target hint.
3. **Single rung name** (or alias: `method`→function, `package`/`directory`/`dir`→module, `service`/`feature`→subsystem, `line`/`lines`/`statement`→expression) → jump to that rung.
4. **Rung name + remaining tokens** (in either order) → jump to that rung, scoped to the remaining tokens as the target.
5. **Anything else** → shift 1 rung in the chosen direction, with the input as the target/focus.
6. Quoted strings are always literal targets, never parsed as rungs or counts.
7. If the named rung would actually be in the **opposite** direction from what was requested (e.g. `/zoom in module` from a function), do it anyway and let the header reveal it. Don't error.

## Determining the current level

1. Read back through the most recent turns. Identify the smallest concrete thing under discussion (a specific function > a file > a directory > "the system").
2. If the last few turns are about design, planning, or a feature without code, the current level is **product/domain** on the non-code axis.
3. If the session just started and there's no level:
   - For `/zoom in`: ask one short question, or assume **system** and announce that in the header.
   - For `/zoom out`: ask one short question instead of inventing a parent.

## When zooming in (direction = `in`)

Internals over relationships. Specifically:

- The actual control flow, branches, and edge cases of the target.
- Inputs and outputs at this level — preconditions, postconditions, invariants.
- Failure modes, exceptions, and what happens on bad input.
- Concrete examples: trace through with sample values.
- Complexity hotspots, hidden state, side effects.
- For blocks: the role this chunk plays in its function.
- For expressions: what it computes, why it's written this way, what it would look like simplified.

Resist re-explaining the bigger picture the user already has. If you need surrounding context to make a point, name it in one line and move on.

**Reading new files (zoom in):** Default is to **re-read the target** if its source isn't already quoted in recent conversation. Don't read siblings or callers — that's zoom-out's job. If the target name is ambiguous (multiple matches), list the candidates briefly, pick the best fit from context, and proceed.

If the target doesn't exist in the codebase, say so. Don't fabricate. Offer the closest match.

## When zooming out (direction = `out`)

Relationships over internals. Specifically:

- **Callers and dependents**: who uses this, what would break if it changed.
- **Role**: what job this thing does in the larger whole, and why it exists.
- **Contracts and boundaries**: what this thing promises, what it depends on.
- **Neighbors**: sibling functions/files/modules and how they divide responsibility.
- **Data flow**: what flows in, what flows out, where it crosses boundaries.
- **Why-it-is-the-way-it-is**: design choices visible only from this level.

Resist re-explaining the internals the user already knows. If the user just came from zoom-in, assume they have the details and focus on the outside view.

For non-code zoom-out: step from a specific behavior to the feature it serves, from a feature to the user problem it solves, from a decision to the constraints that shaped it.

**Reading new files (zoom out):** Default is **don't read new files**. Work from what's in conversation plus, at most, the imports/exports and direct callers of files already in context. Zoom-out fails by drowning in irrelevant call sites — keep it tight.

Exceptions:
- If the parent rung isn't represented in conversation at all (e.g. you have a function but nothing about its file or module), read just enough to name and characterize the parent.
- If you must search for callers, prefer `grep` for the symbol over reading whole files. Cite `file:line`, don't quote large blocks.

## Edge cases

- **Already at expression** (zoom in): deeper is impossible. State that and offer adjacent moves: trace data flow into this expression, examine sibling expressions, or step back to the enclosing block.
- **Already at system** (zoom out): outward lands on **product/domain**. Discuss roadmap, design intent, or unstated goals. If the user clearly wants to stay in code, say there's no further rung and ask.
- **Target not in scope**: search for it; if no match, report what you looked at and ask.
- **Orphan target** (zoom out, utility function with no obvious parent module): walk the import graph backward. If that fails, treat the containing file as the parent and note the ambiguity with `· ambiguous` in the header.
- **Ambiguous module** in a monorepo (multiple `auth/` directories): list candidates briefly, pick the one matching recent context, mention the others.
- **Count overshoots**: clamp to the endpoint (expression for in, system/product-domain for out) and note `· clamped` in the header.
- **Off-code conversation**: use the non-code axis (feature → behavior → corner case → specific assertion). Note `· off-code` in the header.

## Output format

Start your reply with a single-line header on its own line:

`**Zoom in ▸ <from-rung> → <to-rung> · `<target>` · <path-if-known>**`

`**Zoom out ▸ <from-rung> → <to-rung> · `<target>` · <path-if-known>**`

Examples:
- `**Zoom in ▸ module → function · `authenticate` · src/auth/login.ts:42**`
- `**Zoom in ▸ function → block · "the retry loop" · src/jobs/runner.ts:88-104**`
- `**Zoom in ▸ system → subsystem · auth**`
- `**Zoom in ▸ expression → expression · already at bottom**`
- `**Zoom out ▸ function → module · `src/auth/` (auth subsystem)**`
- `**Zoom out ▸ module → subsystem · payments**`
- `**Zoom out ▸ block → function · `runJob` · src/jobs/runner.ts**`
- `**Zoom out ▸ system → product/domain · off-code**`

Append modifiers as applicable: ` · clamped` if a count was clamped, ` · off-code` if using the non-code axis, ` · ambiguous` if you guessed the target or the parent was unclear.

After the header, deliver the content. Don't re-announce the level in prose — the header already did.

## Tone

For zoom in: direct and specific. The reader wants detail, not summary. Use concrete examples and walk through behavior with real values when useful. Cite `file:line` when you reference code.

For zoom out: crisp, high signal-to-noise. The reader is widening their view; give them the map, the boundaries, and the why. Cite `file:line` when grounding a relationship claim, but quote sparingly.
