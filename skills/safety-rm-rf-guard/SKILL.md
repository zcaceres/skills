---
name: safety-rm-rf-guard
description: Blocks rm, shred, unlink, find -delete, and sudo/xargs/subshell variants in Claude Code; redirects to the trash CLI so deletions stay recoverable. PreToolUse hook on Bash. Frontmatter block fires only when this skill is active in context; run `scripts/install.sh` after `npx skills add` for always-on protection.
hooks:
  PreToolUse:
    - matcher: Bash
      type: command
      command: "~/.claude/skills/safety-rm-rf-guard/scripts/run.sh"
---

# safety-rm-rf-guard

A PreToolUse hook that intercepts every `Bash` tool call, scans the command
string for destructive deletion patterns, and blocks the call with a message
steering the agent to `trash` instead. It blocks by printing a
`permissionDecision: "deny"` JSON object on stdout and exiting 0 — the
PreToolUse contract that both Claude Code and Codex honor (see
[How it works](#how-it-works) and [Codex CLI](#codex-cli)). Quoted strings are
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

```sh
npx skills add zcaceres/skills -s safety-rm-rf-guard
~/.claude/skills/safety-rm-rf-guard/scripts/install.sh
```

The second step wires this skill's `PreToolUse:Bash` hook into
`~/.claude/settings.json` so it fires on every Bash call, not just when
this skill is active in context. The script is idempotent, backs up the
target file with a timestamp, and is a no-op if the hook is already
wired. Flags: `--project` (writes to `./.claude/settings.json`),
`--target PATH` (explicit file). Requires `jq`.

**Why two steps.** The `skills` CLI is a pure file copier and runs no
publisher code on install. The frontmatter `hooks:` block above does
register the hook, but only while this skill is loaded into the
conversation context — not always-on. `install.sh` is what closes that
gap for users who want every `rm` blocked regardless of which skill
happens to be active.

Verify it's wired up by running any Bash command in Claude Code (after a
restart); the hook denies and surfaces a `BLOCKED: …` reason when it
catches `rm`/`shred`/etc.

### Manual wiring (alternative)

If you'd rather not run a script, paste this into `~/.claude/settings.json`
(or your project's `.claude/settings.json`) with `<path>` set to the
unpacked skill's absolute path:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "<path>/safety-rm-rf-guard/scripts/run.sh" }
        ]
      }
    ]
  }
}
```

On Windows, point at `scripts\\run.cmd` instead.

### Codex CLI

The same binary works on Codex CLI. Codex's hook engine delivers the same
stdin JSON payload (`tool_input.command`) and honors the same `PreToolUse`
`permissionDecision: "deny"` stdout contract this guard emits — so no rebuild
or variant binary is needed. Codex does **not** read the `hooks:` frontmatter,
so the install is manual.

Add to `~/.codex/config.toml` (note the **top-level** `[[PreToolUse]]` table —
not `[[hooks.PreToolUse]]`):

```toml
[[PreToolUse]]
matcher = "Bash"

[[PreToolUse.hooks]]
type = "command"
command = "/abs/path/to/safety-rm-rf-guard/scripts/run.sh"
timeout = 30
```

After editing, run `/hooks` inside Codex to review and **trust** the new hook
— Codex registers user-defined hooks as untrusted until you approve them.

**Known limitation.** Codex's `PreToolUse` doesn't intercept every shell
invocation yet — the newer `unified_exec` streaming path has incomplete
coverage. The guard catches the common `Bash`-tool calls but is best-effort
on Codex, not airtight. Pair it with sandboxing and backups as you would on
Claude Code.

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
   match, the binary prints a `PreToolUse` JSON object on stdout —
   `{"hookSpecificOutput": {"hookEventName": "PreToolUse",
   "permissionDecision": "deny", "permissionDecisionReason": "BLOCKED: …"}}`
   — and exits 0, which both Claude Code and Codex read as "block this call
   and show the reason." Otherwise it prints nothing and exits 0 (allow).
