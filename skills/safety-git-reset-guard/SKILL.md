---
name: safety-git-reset-guard
description: Blocks destructive git commands (reset --hard, push --force, clean -f, checkout <path>, branch -D, stash drop/clear, worktree remove --force) in Claude Code while letting safer alternatives (--force-with-lease, --soft/--mixed, restore, branch -d) through. PreToolUse hook on Bash. Frontmatter block fires only when this skill is active in context; run `scripts/install.sh` after `npx skills add` for always-on protection.
hooks:
  PreToolUse:
    - matcher: Bash
      type: command
      command: "~/.claude/skills/safety-git-reset-guard/scripts/run.sh"
---

# safety-git-reset-guard

A PreToolUse hook that intercepts every `Bash` tool call, scans the command
string for destructive git invocations, and blocks the call (exit code 2)
with a message pointing at safer alternatives. Quoted strings are stripped
first so `echo 'git reset --hard'` and `git commit -m "fix reset --hard bug"`
are unaffected.

This is a **defense layer, not a guarantee.** A motivated adversary or a
sufficiently creative invocation can bypass any regex check. Run it alongside
sandboxing, code review, and backups — not in place of them.

## Blocked patterns

| Class | Examples |
|---|---|
| `git reset --hard` | any target — `HEAD`, commit SHAs, branches, refs |
| `git push --force` / `-f` | unconditional force push (`--force-with-lease` is allowed) |
| `git clean -f*` / `--force` | `-f`, `-fd`, `-fdx`, `-xf`, `--force` |
| `git checkout <path>` | `git checkout .`, `git checkout -- file` (worktree-discard form) |
| `git branch -D` / `--delete --force` | force-deleting unmerged branches |
| `git stash drop` / `clear` | dropping individual stashes or clearing the list |
| `git worktree remove --force` / `-f` | force-removing dirty worktrees |

### Bypass coverage

- Path variants: `/usr/bin/git`, `./git`, `\git`
- Wrappers: `sudo git`, `command git`, `env git`, `xargs git`
- Subshells: `sh -c '...'`, `bash -c '...'`, `zsh -c '...'`, `dash -c '...'`
- Chained: `cmd && git reset --hard`, `cmd; git push --force`, etc.

## Allowed (explicitly)

- `git reset` (no flag), `git reset --soft`, `git reset --mixed`
- `git push --force-with-lease`, `git push --force-with-lease=ref:expected`
- `git checkout main`, `git checkout -b feature`
- `git clean -n` / `--dry-run`
- `git stash`, `git stash push`, `git stash pop`, `git stash apply`
- `git branch -d merged-branch` (git itself refuses if unmerged)
- Quoted strings: `echo 'git reset --hard'`, `git commit -m "fix reset --hard bug"`

## Install

```sh
npx skills add zcaceres/skills -s safety-git-reset-guard
~/.claude/skills/safety-git-reset-guard/scripts/install.sh
```

The second step wires this skill's `PreToolUse:Bash` hook into
`~/.claude/settings.json` so it fires on every Bash call, not just when
this skill is active in context. The script is idempotent, backs up the
target file with a timestamp, and is a no-op if the hook is already
wired. Flags: `--project`, `--target PATH`. Requires `jq`.

Frontmatter `hooks:` blocks fire only while the skill is loaded into
context, so they're not real always-on protection — `install.sh` closes
that gap. See
[`safety-rm-rf-guard`'s Install section](../safety-rm-rf-guard/SKILL.md#install)
for the full explanation.

You can stack this alongside [`safety-rm-rf-guard`](../safety-rm-rf-guard/SKILL.md) — both
hooks run on every Bash call and either can block.

### Manual wiring (alternative)

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "<path>/safety-git-reset-guard/scripts/run.sh" }
        ]
      }
    ]
  }
}
```

On Windows, point at `scripts\\run.cmd` instead.

## How it works

1. Claude Code invokes the hook before every `Bash` tool call.
2. `scripts/run.sh` picks the right bundled binary for the host OS/arch.
3. The binary reads the JSON payload from stdin, extracts `tool_input.command`.
4. Quoted substrings are stripped (keeping quoted *flag-looking* tokens like
   `'--hard'` since bash unquotes them at exec).
5. Each rule's regex is anchored to a "git invocation": start-of-command, after
   a shell operator (`&&`, `||`, `;`, `|`, `$(`, backtick, newline), or behind
   a known wrapper (`sudo`, `command`, `env`, `xargs`).
6. For `bash -c '...'` style subshells, rules re-run against the *original*
   (unstripped) command so dangerous payloads inside quotes still trip.
7. On match: exit 2 with a `BLOCKED:` message identifying the rule and
   listing safer alternatives. Otherwise exit 0 to allow.
