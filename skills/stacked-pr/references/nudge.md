# `stacked-pr` Hook — PostToolUse Diff-Size Nudge

A PostToolUse hook that runs after every file-modifying tool call
(`Edit`, `Write`, `MultiEdit`, `NotebookEdit`). It opens the current
repo, runs `git diff --numstat HEAD` plus a status-porcelain pass for
untracked files, and — when the uncommitted diff is over the line/file
thresholds — emits a soft reminder telling the agent to consider
`/stacked-pr checkpoint` to ship the slice as a stacked PR.

The hook is **non-blocking by design**. It never exits non-zero, never
returns block payloads, never errors out — soft failures are
intentional so the agent loop is never interrupted.

This document is reference, not a subcommand. The hook activates from
the `hooks:` block in [SKILL.md](../SKILL.md) (or your settings.json
wiring — see Install below) and has no user-facing command surface.

## Thresholds and cooldowns

| Setting | Default | Env var |
|---|---|---|
| Line threshold | 300 lines | `STACKED_PR_NUDGE_LINES` (or legacy `PR_NUDGE_LINES`) |
| File threshold | 8 files | `STACKED_PR_NUDGE_FILES` (or legacy `PR_NUDGE_FILES`) |
| Cooldown window | 30 minutes | (none) |
| Re-fire on +lines delta | 150 | (none) |
| Re-fire on +files delta | 3 | (none) |
| State sweep | 7 days | (none) |
| Subprocess timeout | 300ms | (none) |
| Untracked line cap | 2000 per file | (none) |

The hook re-fires when either:

- 30 minutes have passed since the last fire for this
  `(session_id, repo)` pair, OR
- The diff has grown by ≥150 lines OR ≥3 files since the last fire.

State lives at `~/.claude/state/stacked-pr-nudge.json`. Entries older
than 7 days are swept on the next write. (Distinct from the standalone
`pr-size-nudge` skill's state file — the two coexist without colliding
during the deprecation window.)

## Default exclusions

These paths are excluded from line/file counts (gitignore-style globs):

```
bun.lock, package-lock.json, pnpm-lock.yaml, yarn.lock, Cargo.lock,
go.sum, Gemfile.lock, *.snap, dist/**, build/**, *.min.js, *.min.css
```

Override with `STACKED_PR_NUDGE_EXCLUDE` (colon-separated globs) — or
the legacy `PR_NUDGE_EXCLUDE` env var. Override
`STACKED_PR_NUDGE_SKIP_ROOTS` (colon-separated paths) to skip specific
repos entirely.

## Install

```sh
npx skills add zcaceres/skills -s stacked-pr
~/.claude/skills/stacked-pr/scripts/install.sh
```

The second step wires this hook into `~/.claude/settings.json` so it
fires on every matching tool call, not just when the skill is active
in context. The script is idempotent, backs up the target file with a
timestamp, and is a no-op if the hook is already wired. It derives
the runner path from its own location, so it works whether the skill
was installed at user scope or project scope. Flags: `--project`
(writes to `./.claude/settings.json`), `--target PATH` (explicit
file). Requires `jq`.

If you're migrating from the standalone `pr-size-nudge` skill,
**remove its hook entry from settings.json before running this
install.sh** — otherwise you'll get two nudges per fire, with
different state files. The script prints a warning when it detects
an existing pr-size-nudge entry.

### Why two steps

The `hooks:` block in SKILL.md is the spec-correct shape for a Claude
Code skill that registers a hook, but as of today Claude Code does
**not** substitute `${CLAUDE_SKILL_DIR}` in frontmatter hook commands
— see [anthropics/claude-code#36135](https://github.com/anthropics/claude-code/issues/36135)
(closed as "not planned"). And frontmatter `hooks:` blocks only fire
while the skill is loaded into context — not always-on. `install.sh`
writes an absolute path into `settings.json`, closing both gaps.

### Manual wiring (alternative)

If you'd rather not run a script, paste this into
`~/.claude/settings.json` (or your project's `.claude/settings.json`),
replacing `<path>` with the unpacked skill's absolute path:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit|NotebookEdit",
        "hooks": [
          { "type": "command", "command": "<path>/scripts/run.sh" }
        ]
      }
    ]
  }
}
```

On Windows, point at `scripts\\run.cmd` instead.

## How it works

1. Claude Code invokes `scripts/run.sh` after every matched tool call.
2. `run.sh` picks the right bundled binary for the host OS/arch
   (`stacked-pr-nudge-{darwin-arm64,linux-x64,windows-x64.exe}`).
3. The binary reads the JSON hook payload from stdin (`cwd`,
   `session_id`).
4. It resolves the repo root via `git -C <cwd> rev-parse
   --show-toplevel`. If that fails (not in a repo), the hook exits
   silently.
5. It skips the hook if `cwd` resolves to the user's home directory or
   to any path in `STACKED_PR_NUDGE_SKIP_ROOTS`.
6. It runs `git diff --numstat HEAD` and counts added+deleted lines
   per file, then `git status --porcelain=v1` to fold in untracked
   files (capped at 2000 lines per file).
7. Files matching `STACKED_PR_NUDGE_EXCLUDE` globs are dropped from
   both counts.
8. If `lines < THRESHOLD_LINES` AND `files < THRESHOLD_FILES`, the
   hook exits silently.
9. State is consulted to enforce the cooldown + re-fire deltas. If
   suppressed, exit silently.
10. Otherwise, write a `PostToolUse:additionalContext` payload to
    stdout with a one-liner like:

    > Uncommitted diff is 412 lines across 11 files without a commit.
    > If this work forms a shippable slice, run /stacked-pr checkpoint
    > to land it as a stacked PR before continuing.

11. Update state with the new fire timestamp/lines/files, then exit 0.

## Why this exists

Agent PRs are too big. With "accept all" and "auto mode," a single
task touches dozens of files and edits hundreds or thousands of
lines. This hook nags the agent to commit once it has finished a
logical unit of work. Left open-ended, the agent proposes a slice
back: "I think we can ship {some change} as one unit." When approved,
`/stacked-pr checkpoint` lands it as a focused, stacked PR.

The pattern is an *AI behavioral nudge* — gentle, frequent, non-blocking.
