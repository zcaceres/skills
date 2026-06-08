# review-code-fix

Third step in the code-review trio (`review-code` → `review-code-repro` →
`review-code-fix`). Takes validated findings from the reproduction step,
writes a fix plan (per-finding: approach, risk, verification), and **stops
for user approval** before applying anything.

Skips false positives, defers out-of-scope findings, refuses to fix
un-validated ones without an explicit warning. Honors the user's CLAUDE.md
norms (smallest fix, match codebase style, no `--no-verify`, no scope
widening). After approval, applies fixes in order, runs each finding's
verification, and reports.

Activates when the user says "fix the findings", "plan fixes",
"address the review", or "/review-code-fix".

See [SKILL.md](./SKILL.md) for the full guidelines.

Pure-prompt skill — no scripts, no binaries.

## Install

```sh
npx skills add zcaceres/skills -s review-code-fix
```

Add `-g` for global install, or `-a <agent>` to target a specific agent.
