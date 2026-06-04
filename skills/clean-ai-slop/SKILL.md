---
name: clean-ai-slop
description: Find AI-generated noise on the current branch — tombstone comments, restating-the-code comments, callsite-reference comments, unused imports, dead internal symbols — propose each finding for confirmation, and apply only what's approved. Verify with the project's typecheck and tests after. Use when user says "clean ai slop", "remove ai slop", "strip ai code", or "/clean-ai-slop".
---

# Remove AI code slop

Find AI-generated noise in this branch's diff, propose each finding for confirmation, and apply only what's approved. Verify with the project's typecheck and tests after.

## Scope

Only act on lines in the current diff. Don't expand into ambient cruft from older commits.

**In scope:**
- *Comment/text slop:* tombstones (`// removed X`, `// previously did Y`, `// no longer needed`), restating-the-code comments above obvious lines, verbose docstrings on self-evident functions, emoji and em-dash tells, framing comments (`// for clarity`, `// helper`, `// utility function`), callsite references (`// used by Y`, `// added for the X flow`, `// handles issue #123`), renamed `_unused` params with no callers, comments out of step with the file's norms.
- *Dead code & unused symbols (internal only):* unused imports, unused local variables, unused parameters (only when safe to drop — not interface-required positions), unreachable code, dead internal functions.

**Out of scope — leave untouched even if spotted:**
- `try/catch` and defensive null/undefined checks
- `any` / `unknown` casts
- Redundant variable extractions, one-call-site helpers
- **Unused exports** — too risky (may be external API)
- Anything outside the diff

Those concerns belong to `/simplify` or `/code-review`, not this command.

## Procedure

### 1. Determine the diff base

Resolve in this order:
1. If the user passed a base argument, use it.
2. `git config branch.$(git branch --show-current).stack-parent` — stacked PR parent
3. Upstream tracking branch (`git rev-parse --abbrev-ref @{upstream}`) if it points to a real parent
4. `main`, then `master`

If nothing resolves, stop and ask. Collect the full diff: `git diff <base>...HEAD` plus uncommitted changes (`git diff` + `git diff --cached`). That set of touched lines is the search surface.

### 2. Sample local norms

For each directory touched in the diff, read 2–3 sibling files (not in the diff) to establish baseline style — comment density, docstring conventions, naming. Use this when judging "inconsistent with file" findings. Don't claim inconsistency without a sampled baseline.

### 3. Find dead code & unused symbols

Detection order:
1. **LSP** — if the LSP tool is available, use its unused-symbol diagnostics.
2. **Project linter** — fall back to whatever's configured: `tsc --noEmit`, `eslint`, `ruff check --select F401,F841`, `pyflakes`, `go vet` + `staticcheck`, `cargo check` warnings, etc.
3. If neither is available, **skip the dead-code pass entirely**. Do not grep-guess at structural removals.

Filter results to only symbols touched or introduced in the current diff. **Skip test files** for this pass — fixtures and unused mocks are frequently retained on purpose.

### 4. Find comment & text slop

Scan the diff directly for the patterns listed under Scope. Apply these rules to test files too.

### 5. Propose interactively

For each finding, present:
- `file:line`
- Category (e.g. "tombstone comment", "unused import")
- Exact text to remove
- One-line rationale

Use `AskUserQuestion` with options `Apply`, `Skip`, `Skip category` (skip all remaining findings of this category). Apply each approval immediately so the running diff stays accurate as the user works through the list. Do not batch.

### 6. Verify

After all approved findings are applied:
1. Detect the project's typecheck command from `package.json` scripts, `tsconfig.json` presence, `pyproject.toml`, `go.mod`, `Cargo.toml`, etc.
2. Detect the test command similarly.
3. Run typecheck, then tests.
4. On failure, stop and report the finding(s) most likely responsible. Do **not** auto-revert — let the user decide.

If neither command is configured for the project, say so and skip verification.

## Report

End with a short categorized summary:

```
Applied:
- 5 tombstone comments (3 files)
- 4 unused imports (2 files)

Skipped:
- 1 docstring (kept by user)

Verification: typecheck ✓ · tests ✓
```

No prose padding.
