# loose-ends

A single Claude Code skill that audits **the conversation**, not a diff, and
surfaces every *loose end* — anything raised in the session that could
plausibly need action later, where the discussion moved on without resolving
it. It reports; it never edits code.

**Usage:** `/loose-ends`

## What it catches

It scans for defects, deferred choices, acknowledged shortcuts, untracked
dependencies, unchecked assumptions, and unfulfilled commitments. Those are
search prompts rather than report categories: only unresolved items that a
reasonable engineer might act on make the cut.

Output is one most-actionable-first list, one sentence per item, ending in an
`N loose ends` count. Unconfirmed items are marked `[unsure]`; if nothing
qualifies, the skill says so rather than inventing filler.

See [SKILL.md](./SKILL.md) for the full workflow.

Pure-prompt skill — no scripts, no binaries.

## Install

```sh
npx skills add zcaceres/skills -s loose-ends
```

Add `-g` for global install, or `-a <agent>` to target a specific agent.
