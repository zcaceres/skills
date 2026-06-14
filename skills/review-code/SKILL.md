---
name: review-code
description: Code-review pipeline as one skill. Subcommands review the current branch diff and report bugs as structured findings (review, the default), reproduce and validate each finding to filter false positives (repro), and plan + apply fixes after user approval (fix). Use when the user says "review code", "review my changes", "code review", "reproduce the findings", "validate the review", "fix the findings", "plan fixes", or "/review-code".
argument-hint: "[review | repro | fix] [args]"
---

# Code Review — One Skill

Run the full code-review pipeline as `/review-code [sub] [args]`. Bundles
the three steps — review the diff, reproduce the findings, fix what's
confirmed — into a single skill with subcommands, so the install is one
unit instead of three sibling skills.

**Usage:** `/review-code [subcommand] [args]`

`$ARGUMENTS` is parsed by the dispatcher below. Read the matched subcommand's
reference file and follow it exactly.

## Subcommands

| Subcommand | Reference | What it does |
|---|---|---|
| `review [base-branch]` | [references/review.md](references/review.md) | Review the branch diff (committed + uncommitted) against the merge base and report bugs as a numbered list of inline-style findings. **Default subcommand.** |
| `repro` | [references/repro.md](references/repro.md) | Validate each finding by executing code — failing test, probe run, tool run — and issue a verdict per finding (Confirmed / False positive / Out of scope / Cannot determine). Never fixes anything. |
| `fix` | [references/fix.md](references/fix.md) | Plan the smallest fix for each confirmed finding, stop at an explicit approval gate, then apply and verify. Never edits before the user signs off. |

## Dispatcher

Parse the first whitespace-separated token of `$ARGUMENTS`:

1. **First token is a known subcommand keyword** (`review`, `repro`,
   `fix`) → read `references/<keyword>.md`, then follow its workflow with
   the remaining `$ARGUMENTS` (everything after the first token) as that
   subcommand's arguments.

2. **First token starts with `-`** (e.g. `--help`, `-h`) → print the
   subcommand table above and stop.

3. **First token is anything else, OR `$ARGUMENTS` is empty** → default to
   `review`. Read `references/review.md`, then follow its workflow with
   the *full* `$ARGUMENTS` string as its arguments.

   This means `/review-code` ≡ `/review-code review`, and
   `/review-code against develop` reviews against `develop` — no need to
   type the `review` keyword.

4. **Triggered by natural language** (no explicit `/review-code`) → map
   the user's intent to a subcommand using the trigger phrases in each
   reference's "When to use" section (e.g. "review my changes" →
   `review`, "are these bugs real" → `repro`, "fix the findings" →
   `fix`). If the intent is ambiguous between two subcommands, ask.

## The pipeline

The three subcommands form an ordered pipeline; each consumes the
previous step's output:

```
review  →  numbered findings
repro   →  per-finding verdicts + reproduction artifacts
fix     →  approved plan → applied + verified fixes
```

- Finding numbers are preserved 1:1 across all three steps.
- `repro` validates only — it never fixes.
- `fix` skipped-step rule: invoked without a prior `repro`, it asks
  whether to run `repro` first; if declined, every finding is treated as
  unvalidated ("Confirmed (traced only)") and the plan says so.
- `fix` never edits code before the user explicitly approves the plan.
