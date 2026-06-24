---
name: test
description: Test-suite review pipeline as one skill. Subcommands cross-reference the tests against the source they cover and report missing edge cases — untested branches, error paths, and boundary conditions — as structured findings (gaps, the default). Use when the user says "review my tests", "what tests am I missing", "find missing test cases", "test gaps", "are my tests complete", "find untested edge cases", "audit test coverage", or "/test".
argument-hint: "[gaps] [target]"
---

# Test — One Skill

Review a test suite for completeness as `/test [sub] [args]`. Today the skill
ships one subcommand — `gaps`, which finds the edge cases your tests miss — and
is structured as a dispatcher so more test-related subcommands (e.g. generating
the missing tests, pruning redundant ones, hunting flakiness) can be added later
without changing how it's invoked.

**Usage:** `/test [subcommand] [args]`

`$ARGUMENTS` is parsed by the dispatcher below. Read the matched subcommand's
reference file and follow it exactly.

## Subcommands

| Subcommand | Reference | What it does |
|---|---|---|
| `gaps [target]` | [references/gaps.md](references/gaps.md) | Cross-reference the tests against the source they cover and report missing edge cases — untested branches, error paths, and boundary conditions — as a numbered list of findings. Defaults to the current branch diff; pass a file, directory, or module to scope it. **Default subcommand.** |

_Planned (not yet implemented): `generate` (scaffold the missing tests a `gaps`
run surfaced), `prune` (find redundant or dead tests), `flaky` (hunt
order-dependence and nondeterminism). Don't claim these work — they aren't built
yet._

## Dispatcher

Parse the first whitespace-separated token of `$ARGUMENTS`:

1. **First token is a known subcommand keyword** (`gaps`) → read
   `references/<keyword>.md`, then follow its workflow with the remaining
   `$ARGUMENTS` (everything after the first token) as that subcommand's
   arguments.

2. **First token starts with `-`** (e.g. `--help`, `-h`) → print the
   subcommand table above and stop.

3. **First token is anything else, OR `$ARGUMENTS` is empty** → default to
   `gaps`. Read `references/gaps.md`, then follow its workflow with the *full*
   `$ARGUMENTS` string as its target argument.

   This means `/test` ≡ `/test gaps`, and `/test src/auth` scopes the gap
   review to `src/auth` — no need to type the `gaps` keyword.

4. **Triggered by natural language** (no explicit `/test`) → map the user's
   intent to a subcommand using the trigger phrases in each reference's "When to
   use" section (e.g. "what tests am I missing" → `gaps`). If the intent is
   ambiguous, ask.
