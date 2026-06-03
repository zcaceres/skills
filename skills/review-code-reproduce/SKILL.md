---
name: review-code-reproduce
description: Reproduce and validate each finding from a code review to filter out false positives. Use after /review-code or when the user says "reproduce the bugs", "validate findings", or "/review-code-reproduce".
---

# review-code-reproduce

You are validating a list of findings produced by a prior code review (typically `/review-code`). For each finding, your job is to **prove the bug is real** — or admit you cannot — before any fix gets planned.

A reviewer can be wrong. Misreads, false assumptions about upstream callers, and "this looks risky but isn't actually reachable" are the most common failure modes. Don't trust the finding; reproduce it.

## When to Use This Skill

Activate when the user says:
- "reproduce the bugs" / "reproduce the findings"
- "validate the review" / "validate findings"
- "are these bugs real" / "double-check the review"
- "/review-code-reproduce"

If there is no prior review output visible (in this conversation, a file, a paste, or PR comments), ask the user where the findings are before proceeding.

## Inputs

You need two things:
1. The **list of findings** (from `/review-code`, a pasted review, or PR review comments — `gh pr view <PR> --json reviews` works).
2. The **diff under review** — the same `git diff <merge-base> HEAD` plus `git diff HEAD` that the original review ran against.

If either is missing, surface that gap and stop — don't invent.

## Reproduction Methods (pick the cheapest that proves it)

Reproduction is a spectrum. Use the lightest method that actually demonstrates the bug; escalate only when needed.

1. **Static re-read** — Open the cited file and surrounding context. Verify the finding's claim about control flow / types / callers is accurate. A meaningful share of "bugs" dissolve at this step (the reviewer missed a guard upstream, the callsite passes the value the reviewer assumed was missing, etc.).
2. **Targeted grep / type-check** — `grep` for callsites, run `tsc --noEmit` / `mypy` / equivalent. Confirms the type or call-graph claim.
3. **Write a failing test** — Preferred when the finding describes input → bad output behavior. Smallest possible test that hits the buggy branch. Run it; confirm it fails.
4. **Run the code with a probe input** — One-off script, REPL, or `bun -e` / `python -c` invocation that exercises the suspected path. Capture the output.
5. **Browser / runtime reproduction** — For frontend bugs reachable only via UI state, drive the app with Playwright or Chrome DevTools MCP. For race conditions, multi-process, or anything timing-dependent.
6. **Trace by hand** — Last resort. Walk the path from entry point to bug site and write down the state at each step. Useful when reproduction is genuinely impractical (e.g. requires production data), but explicitly flag the finding as "unreproduced — traced only".

Match the method to the finding's severity claim. A "data loss" finding deserves a failing test; a "this comment is misleading" finding only needs a re-read.

## Verdict Categories

For each finding, classify it as exactly one of:

- **Confirmed** — Reproduced. The bug exists, you've shown it. Include the reproduction artifact (test name, command + output, screenshot, or trace).
- **Confirmed (traced only)** — Path is real but you could not execute it. Explain why reproduction wasn't feasible.
- **False positive** — The finding's premise is wrong. State the specific claim that doesn't hold and cite the code that disproves it.
- **Out of scope** — Real issue, but pre-existing on the base branch (not introduced by this diff). Verify by checking out the merge base and re-checking.
- **Cannot determine** — Insufficient information. Say what would be needed (a stack trace, a specific input, access to a dependency you can't inspect).

Resist the urge to default to **Confirmed**. False positives are not failures of the reviewer — they're the whole reason this step exists.

## Output Format

Mirror the numbering of the input review so the user can match findings 1:1. For each:

```markdown
### **#N <original finding heading>**

**Verdict:** Confirmed | Confirmed (traced only) | False positive | Out of scope | Cannot determine

**Reproduction:**
<test name + how to run it, command + output, file:line trace, or "n/a" with reason>

**Notes:**
<One short paragraph. For false positives, the specific claim that fails and the code that disproves it. For confirmed bugs, any additional context the fix step will need — e.g. "callers in foo.ts and bar.ts also hit this path".>

File: <path:line>
```

End with a one-line tally: `Confirmed: X · False positive: Y · Out of scope: Z · Cannot determine: W`. This tally is the input to `/review-code-fix`.

## Guidelines

- Don't fix anything. Reproduction only. Fixing is the next step (`/review-code-fix`) and requires user approval.
- Don't widen scope. If reproduction surfaces an adjacent bug not in the original review, mention it in a final "Bonus findings" section but don't re-run the review.
- Don't pad the verdict. If you cannot reproduce in reasonable time, say so — "Cannot determine" is a valid answer.
- Run tests in isolation where you can (`bun test path/to/file.test.ts`, not the whole suite) — faster feedback, clearer signal.
- Clean up reproduction artifacts the user wouldn't want committed: delete one-off probe scripts, but **keep** newly written failing tests if they belong in the suite (and mention them in the output so the fix step knows they exist).
