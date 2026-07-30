---
name: laconic
description: Answer in a simple, concise voice, no filler or hedging. Persisted per project or per user, in prose-only, prose+code, or laconic-code (code-first) mode. A per-turn reminder refocuses the voice mid-session (cadence configurable). Invoke via /laconic (on|off|status|mode|cadence).
argument-hint: "[on|off|status|mode|cadence|uninstall] [--project|--user] [prose-only|prose+code|laconic-code] [N]"
disable-model-invocation: true
hooks:
  SessionStart:
    - matcher: "startup|resume|clear|compact"
      type: command
      command: "~/.claude/skills/laconic/scripts/session-start.sh"
  UserPromptSubmit:
    - type: command
      command: "~/.claude/skills/laconic/scripts/prompt-reminder.sh"
---

# laconic

Be concise, plain, and complete.

`laconic` is a control surface plus two hooks. You flip it on (per project or per
user). A `SessionStart` hook injects the voice at the start of every session and
after each context compaction. A `UserPromptSubmit` hook restates it before each
turn to counter mid-session drift, at a cadence you choose (every turn by
default). Both stay silent until you flip laconic on. The voice governs how you
*present* answers, never how you reason.

## Control surface

`/laconic <command> [--project|--user] [prose-only|prose+code|laconic-code]`

All commands run `~/.claude/skills/laconic/scripts/laconic.sh`, which reads and
writes a one-line state file (`<on|off> <mode>`) at the chosen scope:

- **project** → `<project>/.claude/laconic.state`
- **user** → `~/.claude/laconic.state` (default scope)

A project state file overrides the user one, so a project `off` suppresses a
user `on`.

| Command | Effect |
|---|---|
| `on [scope] [mode]` | Turn the voice on. Default scope `--user`, default mode `prose+code`. |
| `off [scope]` | Turn it off at that scope. |
| `mode <prose-only\|prose+code\|laconic-code> [scope]` | Change the mode, keeping on/off as-is. |
| `cadence <N> [scope]` | Fire the per-turn reminder every Nth turn. `1` = every turn (default). |
| `status` | Print the resolved state, mode, and reminder cadence (project vs user). |
| `statusline` | For a status line: print a compact badge when on (`◆ laconic-code` in code mode, `◆ laconic` otherwise), nothing when off. |
| `uninstall [scope]` | Reverse the install for that scope: unwire both hooks, restore the status line, and delete its `laconic.state` and `laconic.cadence`. Idempotent. |

### What to do for each command

- **`on`**: run three steps, in order:
  1. `~/.claude/skills/laconic/scripts/install.sh <--user|--project>` idempotently
     wires **both hooks** (`SessionStart` + `UserPromptSubmit`) **and the
     status-line badge** into that scope's
     `settings.json` (needs `jq`). The badge is added by default: it saves any
     existing `.statusLine` and swaps in the laconic wrapper, which runs the
     original and appends `◆ laconic` when on. Pass `--no-statusline` to wire the
     hook only. Skip the step if it reports both already wired.
  2. `~/.claude/skills/laconic/scripts/laconic.sh on <scope> <mode>` persists the state.
  3. Read `~/.claude/skills/laconic/assets/rules.md` and **adopt the voice
     immediately for the current session**, filtered to the chosen mode. Confirm
     back to the user already in the voice.
- **`off` / `mode` / `status`**: run
  `~/.claude/skills/laconic/scripts/laconic.sh <command> …` and report the result.
  After `off`, return to your normal voice.
- **`uninstall`**: run
  `~/.claude/skills/laconic/scripts/laconic.sh uninstall <--user|--project>` (needs
  `jq`). It unwires **both hooks** (backing up `settings.json` first),
  **restores the status line the installer replaced** (from the saved original),
  and deletes that scope's `laconic.state` and `laconic.cadence`. To drop just the badge and keep the
  voice, run `install.sh`'s counterpart `uninstall.sh --statusline-only`. If it
  warns about a *hand-added* `laconic` reference in a `statusLine` command (one the
  installer didn't manage), tell the user to remove that part by hand. The skill's
  own files stay put; remove them with the skills CLI. Return to your normal voice.

## The voice (canonical: `assets/rules.md`)

`assets/rules.md` is the single source of truth the hooks inject. In short:

- Start with the answer.
- Use the fewest words that preserve the meaning.
- Prefer short, complete sentences.
- Include what the user needs, not everything you know.
- Use structure only when it makes the answer easier to understand.
- Stop when the answer is complete.
- Avoid preambles, filler, repetition, unnecessary caveats, and sign-offs.

Laconic governs presentation, not reasoning. Think fully. Do not omit facts,
risks, uncertainty, or necessary context for the sake of brevity. For security
risks, destructive actions, and genuine ambiguity, be concise but complete.

**Modes.** `prose-only` applies the voice to conversational replies.
`prose+code` (default) also applies it to comments, commit messages, and PR
descriptions without shortening or distorting code. `laconic-code` prefers a
diff, snippet, signature, or file tree when code communicates the answer best,
with brief prose for context, reasoning, risks, and tradeoffs.

If the user says "normal mode" or "stop laconic", stop using the voice for the
rest of the session. Persistent state changes only through `/laconic off`.

## Status-line badge

`install.sh` wires the badge automatically (default; opt out with
`--no-statusline`). It saves any existing `.statusLine` to
`<scope>/laconic.statusline.orig.json` and points `.statusLine.command` at
`scripts/statusline.sh`. That wrapper runs your saved original with the same
stdin payload and appends `◆ laconic` when the voice resolves on (honouring
project-over-user precedence). When off, the badge is empty, so the line is
exactly your original. The wrapper is invisible until you turn laconic on.
`uninstall.sh` restores the saved original; `uninstall.sh --statusline-only`
restores it without touching the hook or state. Wiring is idempotent: a re-run
detects the wrapper and never re-saves it as the "original".

The primitive underneath is `laconic.sh statusline`, which prints `◆ laconic-code`
in code mode, `◆ laconic` in the prose modes, and nothing when off. Call it
directly if you prefer to compose the
badge into a status line by hand instead of using the wrapper.

## Directory layout

- `scripts/laconic.sh`: the control surface (state file read/write); `statusline` prints the badge.
- `scripts/session-start.sh`: the `SessionStart` hook (injects the mode-filtered voice).
- `scripts/prompt-reminder.sh`: the `UserPromptSubmit` hook (per-turn voice reminder, cadence-gated).
- `scripts/statusline.sh`: the status-line wrapper (runs the saved original + appends the badge).
- `scripts/install.sh`: wires both hooks + the badge into `settings.json` (idempotent, backs up).
- `scripts/uninstall.sh`: unwires both hooks, restores the status line, deletes the state and cadence files (idempotent, backs up).
- `assets/rules.md`: the voice the hooks inject.
