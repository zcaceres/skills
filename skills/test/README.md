# test

A single Claude Code skill that reviews a test suite for completeness. It
cross-references your tests against the source they cover and reports the
meaningful gaps — untested branches, error paths, and boundary conditions —
as a tight numbered list of findings.

It's structured as a dispatcher (like `review-code`) so more test-related
subcommands can be added later without changing how it's invoked.

**Usage:** `/test [subcommand] [args]`

Bare `/test` defaults to the `gaps` subcommand.

## Subcommands

| Subcommand | What it does |
|---|---|
| `gaps [target]` | Cross-reference the tests against the source they cover and report missing edge cases — untested branches, error paths, boundary conditions — as a numbered list of findings. Defaults to the current branch diff; pass a file, directory, module, or base branch to scope it. **Default.** |

See [SKILL.md](./SKILL.md) for the dispatcher and
[references/gaps.md](./references/gaps.md) for the full workflow.

The review judges *behavioral* completeness — whether a test would actually
fail if a behavior regressed — not the line-coverage percentage a tool prints.
It applies a strict "would-the-author-actually-add-this-test" bar so the output
is a short list of high-value gaps, not an exhaustive enumeration.

Planned subcommands (not yet implemented): `generate` (scaffold the missing
tests a `gaps` run surfaced), `prune` (find redundant or dead tests), `flaky`
(hunt order-dependence and nondeterminism).

Pure-prompt skill — no scripts, no binaries.

## Install

```sh
npx skills add zcaceres/skills -s test
```
