# `/review-code fix` — Plan and Apply Fixes

You are planning fixes for a set of **validated** code-review findings (typically the output of `/review-code repro`). Plan first, get approval, then implement. Do not edit code before the user signs off on the plan.

The fix step is where bad reviews cause real damage: applying a "fix" for a false positive can introduce a regression. This skill assumes reproduction has already happened — if it hasn't, push back and run `/review-code repro` first.

## When to use

- "fix the findings" / "fix the review"
- "plan fixes" / "plan the fix"
- "apply the review" / "address the review"
- "/review-code fix"

If the user invokes this directly without a prior reproduction step, ask whether they want to run `/review-code repro` first. If they decline, proceed but explicitly flag in the plan that fixes are based on un-validated findings.

## Inputs

You need:
1. The **validated findings** with verdicts (Confirmed / Confirmed (traced only) / False positive / Out of scope / Cannot determine).
2. The **reproduction artifacts** referenced by confirmed findings (failing tests, traces, etc.) — these tell you what success looks like for each fix.
3. The **diff under review** — `git diff <merge-base> HEAD` plus `git diff HEAD`.

## Selection — What to Fix

Only plan fixes for findings with verdict:
- **Confirmed** — fix.
- **Confirmed (traced only)** — fix, but flag that the fix itself is unverified by execution.

Skip:
- **False positive** — no fix. Mention in the plan that you're skipping it and why (one line).
- **Out of scope** — no fix on this branch. Suggest the user open a separate issue/PR if they want it addressed.
- **Cannot determine** — no fix. Ask the user whether to gather more info or skip.

If `/review-code repro` was not run, treat every finding as "Confirmed (traced only)" and warn explicitly.

## Planning the Fix

For each finding you'll address, write:

```markdown
### **Fix #N — <short title>**

**Finding:** <one-line restatement>
**File(s):** <path:line ranges that will change>
**Approach:** <one short paragraph — what changes, why this is the right shape>
**Risk:** <what could go wrong; adjacent code paths that share the bug or depend on the current behavior>
**Verification:** <how you'll prove the fix works — the failing test from reproduction now passes, a specific manual check, a type-check, etc.>
```

Plan principles:
- **Smallest fix that resolves the bug.** Don't refactor surrounding code. Don't add unrelated error handling. The diff under review is already in flight — minimize the new diff.
- **Match the codebase style.** Use the patterns already present in the file. If the file uses `Result<T, E>` style errors, don't introduce thrown exceptions. If it uses early returns, don't add nested ifs.
- **Honor user feedback in their global CLAUDE.md and project CLAUDE.md.** Examples: stacked-PR norms, no `--no-verify`, no premature abstractions, no over-validation of internal callers.
- **One fix per finding by default.** Combine fixes only when two findings are caused by the same root cause and the user would want them addressed in one edit.
- **Call out cross-finding interactions.** If fix #2 makes fix #5 obsolete (or vice versa), say so in the plan and propose an order.

## The Approval Gate

After writing the plan, **stop and ask the user**:

> I've planned fixes for N findings (skipping M). Approve and I'll apply them, or tell me which to drop / change.

Wait for explicit approval. The user might:
- Approve all → proceed.
- Approve a subset → apply only those.
- Reject specific fixes or ask for a different approach → revise the plan; ask again.
- Ask you to commit/stack the fix → follow project norms (`/pr checkpoint` for stacked PRs if the user has that workflow).

Never start editing during the planning phase. Never apply a "small" fix as a freebie before approval.

## Applying the Fix

Once approved:

1. Apply fixes in the order proposed in the plan.
2. After each fix, run its **Verification** step (the test, the type-check, the manual probe).
3. If verification fails, stop. Report what failed before moving on — don't paper over.
4. After all fixes are applied, run the broader test suite (if cheap) and a `git diff` review of the new changes.
5. Report:
   - Which fixes landed and which verifications passed.
   - Any verification that failed and what you did about it.
   - Any new findings that surfaced during fixing (don't fix them; surface them).

## Guidelines

- **Don't widen scope.** If you notice an adjacent bug while fixing, mention it; don't fix it.
- **Don't delete the failing tests from the reproduction step** — they're now passing tests and belong in the suite.
- **Don't bypass safety checks** to make a fix land (no `--no-verify`, no commenting out failing tests).
- **Preserve the original PR author's intent** where the fix is ambiguous. If you're unsure whether they wanted behavior A or B, ask before assuming.
- **Stop and report on the first non-trivial blocker.** A fix that needs a design decision is a user question, not a guess.
