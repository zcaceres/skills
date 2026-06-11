---
name: review-code-repro
description: Reproduce and validate each finding from a code review to filter out false positives. Use after /review-code or when the user says "reproduce the bugs", "validate findings", or "/review-code-repro".
---

# review-code-repro

You are validating a list of findings produced by a prior code review (typically `/review-code`). For each finding, your job is to **prove the bug is real** — or admit you cannot — before any fix gets planned.

A reviewer can be wrong. Misreads, false assumptions about upstream callers, and "this looks risky but isn't actually reachable" are the most common failure modes. Don't trust the finding; reproduce it.

## When to Use This Skill

Activate when the user says:
- "reproduce the bugs" / "reproduce the findings"
- "validate the review" / "validate findings"
- "are these bugs real" / "double-check the review"
- "/review-code-repro"

If there is no prior review output visible (in this conversation, a file, a paste, or PR comments), ask the user where the findings are before proceeding.

## Inputs

You need two things:
1. The **list of findings** (from `/review-code`, a pasted review, or PR review comments — `gh pr view <PR> --json reviews` works).
2. The **diff under review** — the same `git diff <merge-base> HEAD` plus `git diff HEAD` that the original review ran against.

If either is missing, surface that gap and stop — don't invent.

## Reproduction Methods

**Principle: reproduction means running code.** If you didn't execute anything, you didn't reproduce — you re-reviewed. Re-reading the cited file is what the original review already did; doing it again is repetition, not validation.

Static inspection is asymmetric:

- It **can rule a finding out** (False positive) when the code visibly contradicts the reviewer's claim — a guard upstream, a caller that pre-validates, a type that makes the failure mode unrepresentable.
- It **cannot rule a finding in**. To mark a bug **Confirmed**, you need an executable artifact: a failing test, a probe script's captured output, a runtime trace, a browser session.

Pick the cheapest method that actually executes:

1. **Failing test** — Preferred when the finding describes input → bad output. Write the smallest test that hits the buggy branch. Run it. Confirm it fails for the right reason (not a setup error).
2. **Probe-input run** — One-off script, REPL, or `bun -e` / `python -c` / `node -e` invocation that exercises the suspected path. Capture stdout/stderr.
3. **Browser / runtime reproduction** — For frontend bugs reachable only via UI state, drive the app with Playwright or Chrome DevTools MCP. For race conditions, multi-process, or anything timing-dependent.
4. **Tool run (type-check / linter / build)** — When the finding is about something the toolchain checks (`tsc --noEmit`, `mypy`, `cargo check`, an ESLint rule). The tool's pass/fail output is your artifact. Note: running `tsc` and copying the error is reproduction; *predicting* what `tsc` would say is not.
5. **Hand-trace from entry point** — **Last resort, high bar.** Walk from a real entry point (route handler, event listener, CLI subcommand) to the bug site, documenting state at each step with `file:line` references. Only valid when execution is **genuinely impractical** — requires production data, paid external service, hardware you don't have, or a deploy-only code path. "Writing a test is annoying" or "I'd have to set up fixtures" are not impractical. Use this and your verdict is **Confirmed (traced only)** with a one-line justification for why you couldn't execute.

Match the method to the finding's risk: a "data loss" or "auth bypass" finding deserves a failing test, not a trace. A "this error message is misleading" finding can be confirmed by running the code and reading the output.

## Anti-patterns

These all read like "I confirmed it" but are re-review, not reproduction:

- *"On re-read, the off-by-one is present at line 47."* — That's the original review. You haven't shown the off-by-one *manifesting*.
- *"By inspection, this branch doesn't handle null."* — Then call it with null. What actually happens?
- *"Static analysis confirms the finding."* — Static analysis is what the reviewer did. If a real static tool (`tsc`, `mypy`, linter) emits an error, run it and cite the output. Otherwise this phrase means "I agreed with the reviewer."
- *"The code matches the reviewer's description, so the bug is real."* — The description being accurate is necessary but not sufficient — the path may be unreachable, a caller may pre-validate, the failure mode may be benign.
- *"I traced the call graph and the bug occurs."* — Tracing the graph proves the path exists, not that the bug fires. Run the path.

If you catch yourself writing one of the above, escalate to a test or probe before issuing **Confirmed**.

## Verdict Categories

For each finding, classify it as exactly one of:

- **Confirmed** — Reproduced **by executing code**. You must cite the artifact: test name + command + failing output, probe script + captured output, browser screenshot or DOM snapshot, or tool run + error message. No execution artifact → not Confirmed.
- **Confirmed (traced only)** — Path is real, execution was genuinely impractical (production data, paid external service, hardware-only path, deploy-only branch). State *why* execution wasn't possible in one line. Effort is not a reason; this verdict should be rare.
- **False positive** — The finding's premise is wrong. State the specific claim that doesn't hold and cite the `file:line` that disproves it. This is the one verdict where static inspection alone is sufficient evidence.
- **Out of scope** — Real issue, but pre-existing on the base branch (not introduced by this diff). Verify by checking out the merge base and re-checking.
- **Cannot determine** — Insufficient information. Say what would be needed (a stack trace, a specific input, access to a dependency you can't inspect).

Resist the urge to default to **Confirmed** based on re-reading. If the only thing you did was open the file and agree with the reviewer, that is not Confirmed — pick False positive (if the code disproves it), Cannot determine (if you need more info), or actually go run something. False positives are not failures of the reviewer; they're the whole reason this step exists.

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

- Default to executing. Before opening the cited file to "verify the claim", ask: can I write a failing test or run a probe? If yes, do that first — it's both stronger evidence and usually faster than tracing.
- Don't fix anything. Reproduction only. Fixing is the next step (`/review-code-fix`) and requires user approval.
- Don't widen scope. If reproduction surfaces an adjacent bug not in the original review, mention it in a final "Bonus findings" section but don't re-run the review.
- Don't pad the verdict. If you cannot reproduce in reasonable time, **Cannot determine** is the honest answer — better than promoting a re-read to **Confirmed**.
- Run tests in isolation where you can (`bun test path/to/file.test.ts`, not the whole suite) — faster feedback, clearer signal.
- Clean up reproduction artifacts the user wouldn't want committed: delete one-off probe scripts, but **keep** newly written failing tests if they belong in the suite (and mention them in the output so the fix step knows they exist).
