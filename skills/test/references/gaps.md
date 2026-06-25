# `/test gaps` — Find the Edge Cases the Tests Miss

You are reviewing a test suite for completeness. Read the source code under
review, work out the behaviors it can exhibit, then compare that against what
the existing tests actually exercise. Report the meaningful gaps — the untested
branches, error paths, and boundary conditions whose absence would let a real
bug ship — as a tight numbered list.

This is the inverse of code review: you are not judging whether the *code* is
correct, you are judging whether the *tests* would catch it if it weren't.

## When to use

- "review my tests" / "are my tests complete"
- "what tests am I missing" / "find missing test cases"
- "find untested edge cases" / "test gaps"
- "audit test coverage" (the conceptual kind — see the note on coverage below)
- "/test" / "/test gaps"

If there are no tests at all for the code in scope, say so plainly and report
the absence as a single finding rather than enumerating every conceivable case —
then offer to identify the highest-value tests to write first.

## Scope: what to analyze

Default to the **current branch diff** — review the tests for code that changed
on this branch, the same surface a reviewer would look at. Get it with git:

```bash
MERGE_BASE=$(git merge-base origin/main HEAD)
git diff $MERGE_BASE HEAD   # committed changes on this branch
git diff HEAD               # uncommitted work in progress
```

If `origin/main` doesn't exist, fall back to `main` or whichever trunk the repo
uses. If the user passed a target (a file, directory, module, or "against
develop"), scope to that instead of the diff:

- A **path** (`src/auth`, `parser.ts`) → analyze that file/dir and its tests.
- A **base branch** (`against develop`) → diff against that branch instead.
- **No target and no diff** (clean branch) → ask what they want reviewed rather
  than sweeping the whole repo unprompted.

Focus the analysis on **source that changed or was named**, not the test files
in isolation. The tests are the lens; the source is the subject.

## How to find the gaps

1. **Map source → tests.** For each source unit in scope, locate its test
   file(s) by the repo's convention (`foo.ts` → `foo.test.ts` / `__tests__/` /
   `test_foo.py` / a parallel `tests/` tree). If you can't find a test file for
   a changed unit, that's a gap in itself.

2. **Enumerate the behavior space of the source.** For each function, method,
   or branch under review, list what it can actually do — don't guess from the
   name, read the body. Pay attention to:
   - **Branches:** every `if`/`else`, `switch` case, ternary, early return,
     and guard clause. Each side is a distinct behavior.
   - **Error & exception paths:** thrown errors, rejected promises, returned
     error values, `catch` blocks, validation failures, timeouts.
   - **Boundaries:** empty (`""`, `[]`, `{}`), `null`/`undefined`/missing,
     zero, negative, one, max/overflow, off-by-one edges, the first and last
     element, duplicate keys.
   - **State & sequence:** uninitialized state, re-entry, idempotency, order
     dependence, concurrent calls, cleanup/teardown after failure.
   - **Input shape:** unexpected types, malformed data, very large input,
     unicode/encoding, whitespace, injection-shaped strings where relevant.

3. **Check each against the tests.** For every behavior you enumerated, ask: is
   there a test that would *fail* if this behavior broke? A test that merely
   exercises a line without asserting on the outcome doesn't count — a gap can
   hide behind nominal coverage.

4. **Apply the bar (below) and keep only the gaps worth filing.**

## Which gaps to report

Report a missing test only when it clears this bar — the same discipline a
careful engineer applies before adding a test:

1. The untested behavior is real and reachable — you can name a concrete input
   or scenario that triggers it, not a hypothetical.
2. If that behavior regressed, the bug would be meaningful (wrong result, crash,
   data loss, security hole, broken contract) — not cosmetic.
3. The test is one the author would actually add if they saw the gap. Match the
   rigor already present in the suite — don't demand exhaustive boundary tests
   on a repo of one-off scripts, and don't demand tests for trivial pass-through
   code (a plain getter, a one-line delegation) unless it carries real logic.
4. The gap is discrete and actionable — a specific case to add, not "coverage is
   generally low."
5. You are not flagging a behavior the tests already cover indirectly. Verify
   against the actual assertions before claiming something is untested.

Prefer **no findings** over padding the list with low-value cases. A short list
of gaps that would each catch a real bug is worth far more than an exhaustive
enumeration the author will ignore.

> **On coverage tools:** this review is about *behavioral* completeness, not the
> line/branch percentage a coverage tool prints. 100%-line-covered code can
> still miss every error path's *assertion*. If the repo has a coverage command
> and it's cheap to run, you may use it to find never-executed lines as a
> starting point — but the findings must be behavioral gaps, not "raise the
> number."

## Output format

A numbered list. One finding per distinct gap. For each: a short heading, a
one-paragraph explanation of the concrete scenario and what breaks if it
regresses, the source location, and where the test should live. Keep it tight —
mirror the style of an inline review comment, matter-of-fact and non-accusatory.

Example:

```markdown
### **#1 No test for the empty-cart checkout path**

`checkout()` returns early with a `CartEmptyError` when `items.length === 0`,
but every test seeds at least one item, so this branch is unexercised. A
regression that let an empty cart through to payment would ship undetected.

Source: src/checkout/checkout.ts:42 (the `items.length === 0` guard)
Test: add to src/checkout/checkout.test.ts

### **#2 Boundary not covered: maximum quantity**

`addItem` rejects quantities above `MAX_QTY` (999), but tests only cover 1 and
10. The `> MAX_QTY` branch and the exact `=== MAX_QTY` boundary are untested, so
an off-by-one in the limit check would pass CI.

Source: src/cart/cart.ts:18
Test: add to src/cart/cart.test.ts
```

If the tests in scope are genuinely complete for the behavior under review, say
so directly — do not invent gaps to fill the list.

Once the gaps are agreed, the planned `generate` subcommand will scaffold the
missing tests; until it ships, offer to write the highest-value ones directly.
