---
name: rm-rf-guard
description: Blocks rm, shred, unlink, find -delete, and sudo/xargs/subshell variants in Claude Code; redirects to the trash CLI so deletions stay recoverable. PreToolUse hook on Bash — activates automatically.
hooks:
  PreToolUse:
    - matcher: Bash
      type: command
      command: "${SKILL_DIR}/scripts/run.sh"
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

## Manual wiring (fallback)

If your agent doesn't honor the `hooks` frontmatter, add this to
`.claude/settings.json` (replacing `<path>` with the unpacked skill directory):

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

1. Claude Code invokes the hook before every `Bash` tool call.
2. `scripts/run.sh` picks the right bundled binary for the host OS/arch.
3. The binary reads the JSON payload from stdin, extracts `tool_input.command`.
4. Quoted substrings are stripped to remove false positives.
5. The remaining string is matched against destructive patterns. If any match,
   exit 2 with an explanatory message — Claude Code blocks the tool call. Otherwise exit 0.
