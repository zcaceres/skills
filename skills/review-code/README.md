# review-code

A single Claude Code skill that bundles the full code-review pipeline:
review the diff, reproduce the findings, fix what's confirmed. Supersedes
the two sibling skills (`review-code-repro`, `review-code-fix`) that
previously had to be installed separately.

**Usage:** `/review-code [subcommand] [args]`

Bare `/review-code` defaults to the `review` subcommand — same behavior
as before the consolidation.

## Subcommands

| Subcommand | What it does |
|---|---|
| `review [base-branch]` | Diff the current branch against the merge base, apply a strict "would-the-author-actually-fix-this" bar, and emit a tight numbered list of findings formatted for inline review. **Default.** |
| `repro` | Validate each finding by executing code — failing test, probe run, tool run — and issue a per-finding verdict (Confirmed / False positive / Out of scope / Cannot determine). Filters false positives before any fix is planned. |
| `fix` | Plan the smallest fix for each confirmed finding, stop at an explicit approval gate, then apply and verify. Never edits before sign-off. |

See [SKILL.md](./SKILL.md) for the dispatcher and the per-subcommand
references for the full workflows.

The steps form a pipeline — finding numbers are preserved 1:1 from
`review` through `repro` to `fix`, and each step consumes the previous
step's output. Each can also run standalone (e.g. `repro` against a
pasted review or PR comments).

Pure-prompt skill — no scripts, no binaries.

## Install

```sh
npx skills add zcaceres/skills -s review-code
```

## GitHub Action

To run the review-step guidelines on every PR via OpenAI Codex, see
[zcaceres/gh-actions-codex-review](https://github.com/zcaceres/gh-actions-codex-review).
It ships a two-file workflow that vendors this skill's review prompt and
posts Codex's findings as a PR comment.

## Origin

Consolidates these previously-separate skills into one distributable unit:

- `review-code` → `/review-code review` (the default)
- `review-code-repro` (removed) → `/review-code repro`
- `review-code-fix` (removed) → `/review-code fix`
