---
name: pr-size-nudge
description: Claude Code PostToolUse hook that injects a soft system-reminder when the uncommitted diff grows past size/file thresholds. Nudges toward /checkpoint to land a stacked PR. Cooldowns + dedup state.
hooks:
  PostToolUse:
    - matcher: "Edit|Write|MultiEdit|NotebookEdit"
      type: command
      command: "${CLAUDE_SKILL_DIR}/scripts/run.sh"
---

# pr-size-nudge

A PostToolUse hook that runs after every file-modifying tool call (`Edit`,
`Write`, `MultiEdit`, `NotebookEdit`). It opens the current repo, runs
`git diff --numstat HEAD` + a status-porcelain pass for untracked files,
and — when the uncommitted diff is over the line/file thresholds — emits a
soft reminder telling the agent to consider `/checkpoint` to ship the
slice as a stacked PR.

The hook is **non-blocking by design**. It never exits non-zero, never
returns block payloads, never errors out — soft failures are intentional
so the agent loop is never interrupted.

## Thresholds and cooldowns

| Setting | Default | Env var |
|---|---|---|
| Line threshold | 300 lines | `PR_NUDGE_LINES` |
| File threshold | 8 files | `PR_NUDGE_FILES` |
| Cooldown window | 30 minutes | (none) |
| Re-fire on +lines delta | 150 | (none) |
| Re-fire on +files delta | 3 | (none) |
| State sweep | 7 days | (none) |
| Subprocess timeout | 300ms | (none) |
| Untracked line cap | 2000 per file | (none) |

The hook re-fires when either:
- 30 minutes have passed since the last fire for this `(session_id, repo)` pair, OR
- The diff has grown by ≥150 lines OR ≥3 files since the last fire.

State lives at `~/.claude/state/pr-size-nudge.json`. Entries older than 7 days are swept on the next write.

## Default exclusions

These paths are excluded from line/file counts (gitignore-style globs):

```
bun.lock, package-lock.json, pnpm-lock.yaml, yarn.lock, Cargo.lock,
go.sum, Gemfile.lock, *.snap, dist/**, build/**, *.min.js, *.min.css
```

Override with `PR_NUDGE_EXCLUDE` (colon-separated globs). Override
`PR_NUDGE_SKIP_ROOTS` (colon-separated paths) to skip specific repos
entirely.

## Install

> **Important.** The `hooks:` block above is the spec-correct shape for a
> Claude Code skill that registers a hook, but as of today Claude Code
> does **not** substitute `${CLAUDE_SKILL_DIR}` in frontmatter hook
> commands — see
> [anthropics/claude-code#36135](https://github.com/anthropics/claude-code/issues/36135)
> (closed as "not planned"). Until that lands, the only reliable install
> path is to wire the hook into your settings file directly with an
> absolute path.

After unpacking the skill, add this to `~/.claude/settings.json` (or
your project's `.claude/settings.json`), replacing `<path>` with the
unpacked skill's absolute path:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit|NotebookEdit",
        "hooks": [
          { "type": "command", "command": "<path>/pr-size-nudge/scripts/run.sh" }
        ]
      }
    ]
  }
}
```

On Windows, point at `scripts\\run.cmd` instead.

The hook is best paired with the [`checkpoint`](../checkpoint/SKILL.md) skill,
which is what the nudge tells the agent to invoke.

## How it works

1. Claude Code invokes `scripts/run.sh` after every matched tool call.
2. `run.sh` picks the right bundled binary for the host OS/arch.
3. The binary reads the JSON hook payload from stdin (`cwd`, `session_id`).
4. It resolves the repo root via `git -C <cwd> rev-parse --show-toplevel`.
   If that fails (not in a repo), the hook exits silently.
5. It skips the hook if `cwd` resolves to the user's home directory or to
   any path in `PR_NUDGE_SKIP_ROOTS`.
6. It runs `git diff --numstat HEAD` and counts added+deleted lines per file,
   then `git status --porcelain=v1` to fold in untracked files (capped at
   2000 lines per file).
7. Files matching `PR_NUDGE_EXCLUDE` globs are dropped from both counts.
8. If `lines < THRESHOLD_LINES` AND `files < THRESHOLD_FILES`, the hook exits
   silently.
9. State is consulted to enforce the cooldown + re-fire deltas. If
   suppressed, exit silently.
10. Otherwise, write a `PostToolUse:additionalContext` payload to stdout
    with a one-liner like:

    > Uncommitted diff is 412 lines across 11 files without a commit.
    > If this work forms a shippable slice, run /checkpoint to land it
    > as a stacked PR before continuing.

11. Update state with the new fire timestamp/lines/files, then exit 0.

## Why this exists

Agent PRs are too big. With "accept all" and "auto mode," a single task
touches dozens of files and edits hundreds or thousands of lines. This
hook nags the agent to commit once it has finished a logical unit of work.
Left open-ended, the agent proposes a slice back: "I think we can ship
{some change} as one unit." When approved, `/checkpoint` lands it as a
focused, stacked PR.

The pattern is an *AI behavioral nudge* — gentle, frequent, non-blocking.
