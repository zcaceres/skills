---
name: pr
description: One skill for committing work and opening PRs. Two modes — normal (default) commits your conversation changes, pushes, and opens a single PR against the trunk; stacked turns the same command into a stacked-PR workflow (checkpoint slices, submit, sync, bottom-up merge). Toggle with /pr setup. Also ships a PostToolUse hook that nudges toward /pr when the uncommitted diff grows large. Uses git stack when installed, falls back to gh + git. Invoke via /pr [subcommand] [args].
argument-hint: "[commit | setup | update | log | merge | checkpoint | submit | sync] [args]"
disable-model-invocation: true
hooks:
  PostToolUse:
    - matcher: "Edit|Write|MultiEdit|NotebookEdit"
      type: command
      command: "${CLAUDE_SKILL_DIR}/scripts/run.sh"
---

# PR — One Skill

Commit your work and open a pull request with `/pr`. The skill has two
modes:

- **normal** (default) — commit the changes you made in this conversation,
  push, and open a single PR against the trunk (`main`/`master`). This is
  the everyday "ship my work" flow.
- **stacked** — the same command becomes a stacked-PR workflow: each `/pr`
  slices the current diff onto a new branch stacked on the last one, plus
  subcommands to push the whole stack, rebase onto trunk, and merge
  bottom-up.

Normal mode is the default. Stacked mode is opt-in — see
[`/pr setup`](references/setup.md).

**Usage:** `/pr [subcommand] [args]`

`$ARGUMENTS` is parsed by the dispatcher below. Read the matched
subcommand's reference file and follow it exactly.

## Determine the mode first

Before dispatching, read the active mode:

```bash
git config pr.mode 2>/dev/null   # resolves local, then global; empty = unset
```

- Output `stacked` → **stacked mode**.
- Output `normal`, empty, or anything else → **normal mode** (the default).

Mode only changes what the **default** action (bare `/pr` or a
description with no subcommand) does. Every *named* subcommand works in
either mode — the user asked for it by name, so honor it.

## Subcommands

| Subcommand | Reference | What it does |
|---|---|---|
| `commit [message]` | (alias) | Run the **default action** for the active mode — `update` in normal mode, `checkpoint` in stacked mode. The everyday "ship my work" verb; identical to bare `/pr`. |
| `setup` | [references/setup.md](references/setup.md) | Show the current mode and switch between `normal` and `stacked` (writes `git config pr.mode`, global by default). |
| `update [base-branch]` | [references/update.md](references/update.md) | Commit + push + update the current branch's PR (or open one if missing). Doesn't change an existing PR's base. **This is the normal-mode default.** |
| `log` | [references/log.md](references/log.md) | Read-only. In stacked mode print the stack tree; in normal mode list the current branch's PR (falls back to `gh pr list`). |
| `merge [--merge\|--rebase\|--squash] [--all] [--dry-run]` | [references/merge.md](references/merge.md) | In normal mode merge the current branch's single PR. In stacked mode land the stack bottom-up with retarget verification. |
| `checkpoint [slice description]` | [references/checkpoint.md](references/checkpoint.md) | Cut the current uncommitted diff as the next branch in a stack, push it, open a PR against the parent branch. **This is the stacked-mode default.** |
| `submit` | [references/submit.md](references/submit.md) | Push the whole stack (force-with-lease) and create/update one PR per branch. Stacked workflow; requires `git stack`. |
| `sync [--no-push]` | [references/sync.md](references/sync.md) | Fetch trunk and rebase every branch in the stack onto the updated tip. Stacked workflow. |

## Bundled hook

A PostToolUse hook is shipped with this skill. It fires after every
`Edit`/`Write`/`MultiEdit`/`NotebookEdit` tool call and nudges toward
`/pr` when the uncommitted diff crosses size/file thresholds — so you
land a focused PR (a stacked checkpoint in stacked mode) before the diff
grows unwieldy.

Two-step install:

```sh
npx skills add zcaceres/skills -s pr
~/.claude/skills/pr/scripts/install.sh
```

The second step wires the hook into `~/.claude/settings.json` so it
fires on every matching tool call, not just when the skill is active
in context (`${CLAUDE_SKILL_DIR}` substitution in frontmatter hook
commands is not supported by Claude Code today). The script
self-locates, so the same command works whether the skill was
installed at user scope or project scope. Flags: `--project`,
`--target PATH`. Requires `jq`. See [references/nudge.md](references/nudge.md)
for thresholds, env-var overrides, and manual wiring as an alternative.

`install.sh` also provisions the compiled binary the hook execs (a
file-copy install ships the source but not the ~60 MB binary) by
running `scripts/fetch-binary.sh` — which downloads the prebuilt binary
for your platform from the skill's GitHub release, or builds it with
`bun`. `/pr setup` runs it too, so configuring the skill leaves the
hook fully functional. See [references/nudge.md](references/nudge.md#provisioning-the-binary).

## Dispatcher

First read the mode (see "Determine the mode first" above), then parse
the first whitespace-separated token of `$ARGUMENTS`:

1. **First token is `setup`** → read [references/setup.md](references/setup.md)
   and follow it. This is how the user switches modes.

2. **First token is `update`, `log`, or `merge`** → read
   `references/<keyword>.md`, then follow its workflow with the remaining
   `$ARGUMENTS` as that subcommand's arguments. These work in both modes;
   each reference has a mode-specific path.

3. **First token is `checkpoint`, `submit`, or `sync`** (stacked
   operations) → read `references/<keyword>.md` and follow it with the
   remaining `$ARGUMENTS`. These run regardless of mode — an explicit
   keyword is explicit intent. If the mode is not `stacked`, add a
   one-line note: "(You're in normal mode — `/pr setup` makes `/pr`
   default to stacked operations.)"

4. **First token starts with `-`** (e.g. `--help`, `-h`) → print this
   subcommand list and stop.

5. **First token is `commit`, anything else, OR `$ARGUMENTS` is empty** →
   this is the **default action**, which depends on the mode:

   - **normal mode** → read [references/update.md](references/update.md)
     and follow it. This commits your conversation changes, pushes, and
     opens (or updates) a single PR against the trunk.

   - **stacked mode** → read [references/checkpoint.md](references/checkpoint.md)
     and follow it, using the message as the slice description.

   `commit` is an explicit, mode-aware alias for this default action — it
   is **not** hard-wired to `checkpoint`, so it never forces stacked
   behavior on a normal-mode user. When the first token is literally
   `commit`, strip it and pass the *remaining* `$ARGUMENTS` as the commit
   message / slice description. For any other non-keyword first token, the
   *full* `$ARGUMENTS` string seeds the commit message / PR title.

   So in normal mode `/pr` ≡ `/pr commit` ≡ `/pr update`, and in stacked
   mode `/pr` ≡ `/pr commit` ≡ `/pr checkpoint` — no need to type the
   keyword for the everyday action.

If the agent is unsure which mode the user wants — e.g. the first token
is ambiguous between a subcommand and a description — ask the user before
acting. Don't guess at workflow-changing inputs.

## Important — applies to every subcommand

- NEVER commit files you didn't modify in this conversation.
- NEVER use `git add .` or `git add -A`. Stage explicitly.
- Report the PR URL when done.
- If `git stack` is installed and the branch is stacked, prefer its
  primitives over hand-rolled `gh` loops.
