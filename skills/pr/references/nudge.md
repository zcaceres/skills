# `pr` Hook — Diff-Size Nudge

A hook that runs after every file-modifying tool call — `PostToolUse`
(`Edit`, `Write`, `MultiEdit`, `NotebookEdit`) under Claude Code, and
`AfterTool` (`replace`, `write_file`) under Gemini CLI. It opens the
current repo, measures the uncommitted diff (on **git** via
`git diff --numstat HEAD` plus a status-porcelain pass for untracked
files; on **jj** via `jj diff --git -r @`), and — when the diff is over
the line/file thresholds — emits a soft reminder telling the agent to
consider `/pr` to land the slice as a focused PR (a stacked checkpoint
in stacked mode). The same compiled binary serves both hosts: it reads
the host's event name from the hook payload, echoes it back in the
output envelope, and homes its state file accordingly (see below).

The hook is **non-blocking by design**. It never exits non-zero, never
returns block payloads, never errors out — soft failures are
intentional so the agent loop is never interrupted.

This document is reference, not a subcommand. The hook activates from
the `hooks:` block in [SKILL.md](../SKILL.md) (or your settings.json
wiring — see Install below) and has no user-facing command surface.

## Thresholds and cooldowns

| Setting | Default | Env var |
|---|---|---|
| Line threshold | 200 lines | `PR_NUDGE_LINES` (alias: `STACKED_PR_NUDGE_LINES`) |
| File threshold | 4 files | `PR_NUDGE_FILES` (alias: `STACKED_PR_NUDGE_FILES`) |
| Cooldown window | 30 minutes | (none) |
| Re-fire on +lines delta | 150 | (none) |
| Re-fire on +files delta | 3 | (none) |
| State sweep | 7 days | (none) |
| Subprocess timeout | 300ms | (none) |
| Untracked line cap (git only) | 2000 per file | (none) |

The hook re-fires when either:

- 30 minutes have passed since the last fire for this
  `(session_id, repo)` pair, OR
- The diff has grown by ≥150 lines OR ≥3 files since the last fire.

State lives under the config dir of whichever host fired the hook —
`~/.claude/state/pr-nudge.json` for Claude Code, `~/.gemini/state/pr-nudge.json`
for Gemini CLI (the binary picks the dir from the payload's event name;
override with `PR_NUDGE_STATE_DIR`). Entries older than 7 days are swept
on the next write. (Distinct from the standalone `pr-size-nudge` skill's
state file — the two coexist without colliding if you happen to have
both installed.)

## Default exclusions

These paths are excluded from line/file counts (gitignore-style globs):

```
bun.lock, package-lock.json, pnpm-lock.yaml, yarn.lock, Cargo.lock,
go.sum, Gemfile.lock, *.snap, dist/**, build/**, *.min.js, *.min.css
```

Override with `PR_NUDGE_EXCLUDE` (colon-separated globs) — the
`STACKED_PR_NUDGE_EXCLUDE` alias is also accepted. Override
`PR_NUDGE_SKIP_ROOTS` (colon-separated paths) to skip specific repos
entirely.

## Install

```sh
npx skills add zcaceres/skills -s pr
~/.claude/skills/pr/scripts/install.sh                 # Claude Code (default)
# or, for Gemini CLI:
~/.gemini/skills/pr/scripts/install.sh --agent gemini
```

The second step wires this hook into the host's `settings.json`
(`~/.claude` or `~/.gemini`) so it fires on every matching tool call,
not just when the skill is active in context. `install.sh` auto-detects
the host — override with `--agent claude|gemini` — and writes the right
event name (`PostToolUse` / `AfterTool`), tool matcher, and settings
dir. The script is idempotent, backs up the target file with a
timestamp, and is a no-op if the hook is already wired. It derives the
runner path from its own location, so it works whether the skill was
installed at user scope or project scope. Flags: `--agent`, `--project`
(writes to `./.claude/settings.json` or `./.gemini/settings.json`),
`--target PATH` (explicit file). Requires `jq`.

`install.sh` also runs `scripts/fetch-binary.sh` to provision the
binary (see below), so the two-step install both wires the hook *and*
makes it functional.

### Provisioning the binary

The hook execs a compiled binary (`scripts/bin/pr-nudge-<os>-<arch>`).
Those binaries are ~60 MB build artifacts — gitignored, never
committed, fetched or built on demand. A pure file-copy install
(`npx skills add`, a sparse checkout) therefore lands the source and
`run.sh` but **no binary**, and `run.sh` then silently no-ops. That's
the gap `scripts/fetch-binary.sh` closes. Run it directly any time, or
let `install.sh` / `/pr setup` call it for you:

```sh
~/.claude/skills/pr/scripts/fetch-binary.sh
```

It's idempotent and layered — first match wins:

1. Binary already present + executable → done.
2. **Download** the prebuilt binary for this platform from the skill's
   GitHub release (needs `gh`) — the path that works on machines with
   no Bun toolchain. Resolves the latest `pr@*` release, then pulls the
   asset matching `*-<os>-<arch>`. Override with `SKILL_BINARY_REPO`
   (default `zcaceres/skills`) or `SKILL_BINARY_TAG` (default: latest).
3. **Build** locally with `bun` (always matches the local source).
4. Otherwise print manual instructions and exit non-zero.

The script is generic across every binary-bundling skill in this repo
(it derives the skill name from its own location and globs the asset by
platform), so the same file drops into `safety-*` and friends unchanged.

If you're migrating from the standalone `pr-size-nudge` skill,
**remove its hook entry from settings.json before running this
install.sh** — otherwise you'll get two nudges per fire, with
different state files. The script prints a warning when it detects
an existing pr-size-nudge entry.

### Why two steps

The `hooks:` block in SKILL.md is the spec-correct shape for a skill
that registers a hook (it declares both the `PostToolUse` and `AfterTool`
variants, one per host), but as of today neither Claude Code nor Gemini
CLI substitutes `${CLAUDE_SKILL_DIR}` in frontmatter hook commands
— see [anthropics/claude-code#36135](https://github.com/anthropics/claude-code/issues/36135)
(closed as "not planned"). And frontmatter `hooks:` blocks only fire
while the skill is loaded into context — not always-on. `install.sh`
writes an absolute path into the host's `settings.json`, closing both gaps.

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

For **Gemini CLI**, wire the same runner under `~/.gemini/settings.json`
using the `AfterTool` event and Gemini's tool names instead:

```json
{
  "hooks": {
    "AfterTool": [
      {
        "matcher": "replace|write_file",
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

1. The host (Claude Code or Gemini CLI) invokes `scripts/run.sh` after
   every matched tool call.
2. `run.sh` picks the right bundled binary for the host OS/arch
   (`pr-nudge-{darwin-arm64,linux-x64,windows-x64.exe}`).
3. The binary reads the JSON hook payload from stdin (`cwd`,
   `session_id`, and — from Gemini — `hook_event_name`).
4. It resolves the repo root and VCS: `git rev-parse --show-toplevel`
   first, then `jj root`. A **colocated** repo (both `.git` and `.jj`)
   resolves as **git**, so existing behavior is unchanged; a **native
   jj** repo (no `.git`) resolves as **jj**. If neither answers (not in a
   repo, or the VCS binary is missing), the hook exits silently.
5. It skips the hook if `cwd` resolves to the user's home directory or
   to any path in `PR_NUDGE_SKIP_ROOTS`.
6. It measures the diff:
   - **git** — `git diff --numstat HEAD` for added+deleted lines per
     file, then `git status --porcelain=v1` to fold in untracked files
     (capped at 2000 lines per file).
   - **jj** — `jj diff --git -r @` (the working-copy commit vs its
     parent), counting `+`/`-` hunk lines per file. jj has no untracked
     state — new files already live in `@` — so there is no separate
     untracked pass and no per-file line cap on new files.
7. Files matching `PR_NUDGE_EXCLUDE` globs are dropped from
   both counts.
8. If `lines < THRESHOLD_LINES` AND `files < THRESHOLD_FILES`, the
   hook exits silently.
9. State is consulted to enforce the cooldown + re-fire deltas. If
   suppressed, exit silently.
10. Otherwise, write an `additionalContext` payload to stdout — echoing
    the host's event name (`PostToolUse`, or `AfterTool` for Gemini) —
    with a one-liner like:

    > Uncommitted diff is 412 lines across 11 files without a commit.
    > If this work forms a shippable slice, run /pr to land it as a
    > focused PR before continuing.

11. Update state with the new fire timestamp/lines/files, then exit 0.

## Why this exists

Agent PRs are too big. With "accept all" and "auto mode," a single
task touches dozens of files and edits hundreds or thousands of
lines. This hook nags the agent to commit once it has finished a
logical unit of work. Left open-ended, the agent proposes a slice
back: "I think we can ship {some change} as one unit." When approved,
`/pr` lands it as a focused PR (a stacked checkpoint in stacked mode).

The pattern is an *AI behavioral nudge* — gentle, frequent, non-blocking.
