---
name: rm-rf-guard
description: Blocks rm, shred, unlink, find -delete, and sudo/xargs/subshell variants in Claude Code; redirects to the trash CLI so deletions stay recoverable. PreToolUse hook on Bash — activates automatically.
hooks:
  PreToolUse:
    - matcher: Bash
      type: command
      command: "${CLAUDE_SKILL_DIR}/scripts/run.sh"
---

# rm-rf-guard

A PreToolUse hook that intercepts every `Bash` tool call, scans the command
string for destructive deletion patterns, and blocks the call (exit code 2)
with a message steering the agent to `trash` instead. Quoted strings are
stripped first so `echo 'rm foo'` and `git commit -m "rm old"` are unaffected.

This is a **defense layer, not a guarantee.** A motivated adversary or a
sufficiently creative command can bypass any regex check. Run it alongside
sandboxing, version control, and backups — not in place of them.

## What it blocks

**Direct commands:** `rm`, `shred`, `unlink`

**Path variants:** `/bin/rm`, `/usr/bin/rm`, `./rm`

**Bypass attempts:** `command rm`, `env rm`, `\rm`, `sudo rm`, `xargs rm`

**Subshells:** `sh -c "rm …"`, `bash -c "rm …"`, `zsh -c "rm …"`, `dash -c "…"`

**Find:** `find … -delete`, `find … -exec rm …`

## What it allows

- `git rm` (recoverable via git history)
- `rm` inside quoted strings (e.g. `echo 'rm test'`, `grep -E 'rm|del'`)
- Every other command

## Install

> **Important.** The `hooks:` block in the frontmatter above is the
> spec-correct shape for a Claude Code skill that registers a hook, but as
> of today Claude Code does **not** substitute `${CLAUDE_SKILL_DIR}` in
> frontmatter hook commands — see
> [anthropics/claude-code#36135](https://github.com/anthropics/claude-code/issues/36135)
> (closed as "not planned"). Until that lands, the only reliable install
> path is to wire the hook into your settings file directly with an
> absolute path.

After unpacking the skill (`~/.claude/skills/rm-rf-guard/` for personal
installs, or a custom location), add this to `~/.claude/settings.json`
or your project's `.claude/settings.json`, replacing `<path>` with the
unpacked skill's absolute path:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "<path>/rm-rf-guard/scripts/run.sh" }
        ]
      }
    ]
  }
}
```

On Windows, point at `scripts\\run.cmd` instead.

Verify it's wired up by running any Bash command in Claude Code; the hook
prints `BLOCKED: …` on stderr and exit-2s when it catches `rm`/`shred`/etc.

## Prerequisites

The hook itself has no runtime dependencies (pre-built Bun binaries ship in
`scripts/bin/`). For the recommended replacement workflow, install `trash`:

```sh
# macOS
brew install trash

# Linux / cross-platform via npm
npm install -g trash-cli
```

## How it works

1. Claude Code invokes `scripts/run.sh` before every `Bash` tool call
   (after manual wiring — see [Install](#install)).
2. `run.sh` picks the right bundled binary for the host OS/arch from
   `scripts/bin/` (darwin-arm64, linux-x64, or windows-x64.exe).
3. The binary reads the JSON payload from stdin and extracts
   `tool_input.command`.
4. Quoted substrings are stripped to remove false positives.
5. The remaining string is matched against destructive patterns. If any
   match, exit 2 with an explanatory message — Claude Code blocks the
   tool call. Otherwise exit 0.
