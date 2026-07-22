# loose-ends

A single Claude Code skill that audits **the conversation**, not a diff, and
surfaces every *loose end* — anything raised in the session that could
plausibly need action later, where the discussion moved on without resolving
it. It reports; it never edits code.

**Usage:** `/loose-ends`

## What it catches

Six buckets, each filtered by a strict "would an engineer actually act on this"
bar:

- **Bugs mentioned but not fixed** — a defect named in passing, then dropped.
- **Deferred / unsurfaced decisions** — a fork taken implicitly, or a choice
  pushed to "later" and never returned to.
- **Nits & tradeoffs** — a knowing shortcut, an inline TODO, a "good enough for
  now."
- **Cross-workstream** — dependencies or conflicts with other PRs, branches,
  tickets, or migrations that were noted but not tracked.
- **Unverified claims / assumptions** — something asserted and built upon without
  being checked.
- **Promised-but-not-done** — anything the assistant or user said would happen
  that never did.

Output is grouped by bucket, ranked most-actionable-first, one line per item,
ending in a `N loose ends across M areas` count. Empty buckets are dropped, and
if nothing qualifies it says so rather than inventing filler.

See [SKILL.md](./SKILL.md) for the full workflow.

Pure-prompt skill — no scripts, no binaries.

## Install

```sh
npx skills add zcaceres/skills -s loose-ends
```

Add `-g` for global install, or `-a <agent>` to target a specific agent.
