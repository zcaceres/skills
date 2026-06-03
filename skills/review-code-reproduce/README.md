# review-code-reproduce

Second step in the code-review trio (`review-code` → `review-code-reproduce` →
`review-code-fix`). Takes a list of findings from a prior review and, for each
one, **proves the bug is real** or marks it a false positive — before any fix
is planned.

Reproduction methods escalate from cheapest to most expensive: static re-read,
targeted grep / type-check, failing test, probe-input run, browser/runtime
repro, hand-traced path. Each finding ends up in one of five verdict buckets
(`Confirmed`, `Confirmed (traced only)`, `False positive`, `Out of scope`,
`Cannot determine`) and the tally feeds the fix step.

Activates when the user says "reproduce the bugs", "validate findings",
"double-check the review", or "/review-code-reproduce".

See [SKILL.md](./SKILL.md) for the full guidelines.

Pure-prompt skill — no scripts, no binaries.

## Install

```sh
npx skills add zcaceres/skills -s review-code-reproduce
```

Add `-g` for global install, or `-a <agent>` to target a specific agent.
