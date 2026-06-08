---
name: stacked-pr
description: Bundled stacked-PR workflow as one skill. Subcommands ship the next slice (checkpoint), update the current branch's PR (update), and more. Uses git stack when installed, falls back to gh + git. Invoke via /stacked-pr [subcommand] [args].
argument-hint: "[checkpoint | update] [args]"
disable-model-invocation: true
---

# Stacked PRs — One Skill

Run the full stacked-PR workflow as `/stacked-pr <sub> [args]`. Bundles the
authoring primitives — slicing, committing, pushing, opening PRs — into a
single skill with subcommands, so the install is one unit instead of three
sibling skills.

**Usage:** `/stacked-pr [subcommand] [args]`

`$ARGUMENTS` is parsed by the dispatcher below. Read the matched subcommand's
reference file and follow it exactly.

## Subcommands

| Subcommand | Reference | What it does |
|---|---|---|
| `checkpoint [slice description]` | [references/checkpoint.md](references/checkpoint.md) | Cut the current uncommitted diff as the next branch in the stack, push it, open a PR against the parent branch. |
| `update [base-branch]` | [references/update.md](references/update.md) | Commit + push + update the current branch's PR (or open one if missing). Doesn't change the existing PR's base. |

More subcommands (`submit`, `log`, `sync`, `merge`) land in later PRs in
this stack.

## Dispatcher

Parse the first whitespace-separated token of `$ARGUMENTS`:

1. **First token is a known subcommand keyword** (`checkpoint`, `update`) →
   read `references/<keyword>.md`, then follow its workflow with the
   remaining `$ARGUMENTS` (everything after the first token) as that
   subcommand's arguments.

2. **First token is anything else, OR `$ARGUMENTS` is empty** → default to
   `checkpoint`. Read `references/checkpoint.md`, then follow its workflow
   with the *full* `$ARGUMENTS` string as the slice description.

   This means `/stacked-pr` ≡ `/stacked-pr checkpoint` (no args), and
   `/stacked-pr "fix the retry loop"` runs checkpoint with that slice
   description — no need to type the `checkpoint` keyword.

3. **First token starts with `-`** (e.g. `--help`, `-h`) → print this
   subcommand list and stop.

If the agent is unsure which mode the user wants — e.g. the first token is
ambiguous between a subcommand and a description — ask the user before
acting. Don't guess at workflow-changing inputs.

## Important — applies to every subcommand

- NEVER commit files you didn't modify in this conversation.
- NEVER use `git add .` or `git add -A`. Stage explicitly.
- Report the PR URL when done.
- If `git stack` is installed and the branch is stacked, prefer its
  primitives over hand-rolled `gh` loops.
