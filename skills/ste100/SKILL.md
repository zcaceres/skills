---
name: ste100
description: Write in ASD-STE100 Simplified Technical English. One word for one thing, active voice, simple tenses, short sentences, one instruction per sentence. Persisted per project or per user. A per-turn reminder refocuses the rules mid-session (cadence configurable). Invoke via /ste100 (on|off|status|cadence).
argument-hint: "[on|off|status|cadence|uninstall] [--project|--user] [N]"
disable-model-invocation: true
hooks:
  SessionStart:
    - matcher: "startup|resume|clear|compact"
      type: command
      command: "~/.claude/skills/ste100/scripts/session-start.sh"
  UserPromptSubmit:
    - type: command
      command: "~/.claude/skills/ste100/scripts/prompt-reminder.sh"
---

# ste100

Write so a reader with limited English understands you the first time. The
standard is [ASD-STE100 Simplified Technical English](https://www.asd-ste100.org/):
a controlled natural language of 53 writing rules and a controlled dictionary,
built for aircraft maintenance documentation and now an international standard.

`ste100` is a control surface plus two hooks. You flip it on (per project or per
user). A `SessionStart` hook injects the rules at the start of every session and
after each context compaction. A `UserPromptSubmit` hook restates them before
each turn to counter mid-session drift, at a cadence you choose (every turn by
default). Both stay silent until you flip ste100 on. The rules govern how you
*write*, never how you reason, and never the code itself.

## Control surface

`/ste100 <command> [--project|--user]`

All commands run `~/.claude/skills/ste100/scripts/ste100.sh`, which reads and
writes a one-line state file (`on` or `off`) at the chosen scope:

- **project** → `<project>/.claude/ste100.state`
- **user** → `~/.claude/ste100.state` (default scope)

A project state file overrides the user one, so a project `off` suppresses a
user `on`.

| Command | Effect |
|---|---|
| `on [scope]` | Turn the rules on. Default scope `--user`. |
| `off [scope]` | Turn them off at that scope. |
| `cadence <N> [scope]` | Fire the per-turn reminder every Nth turn. `1` = every turn (default). |
| `status` | Print the resolved state and reminder cadence (project vs user). |
| `statusline` | For a status line: print `◆ ste100` when on, nothing when off. |
| `uninstall [scope]` | Reverse the install for that scope: unwire both hooks, restore the status line, and delete its `ste100.state` and `ste100.cadence`. Idempotent. |

### What to do for each command

- **`on`**: run three steps, in order:
  1. `~/.claude/skills/ste100/scripts/install.sh <--user|--project>` idempotently
     wires **both hooks** (`SessionStart` + `UserPromptSubmit`) **and the
     status-line badge** into that scope's `settings.json` (needs `jq`). The
     badge is added by default: it saves any existing `.statusLine` and swaps in
     the ste100 wrapper, which runs the original and appends `◆ ste100` when on.
     Pass `--no-statusline` to wire the hooks only. Skip the step if it reports
     both already wired.
  2. `~/.claude/skills/ste100/scripts/ste100.sh on <scope>` persists the state.
  3. Read `~/.claude/skills/ste100/assets/rules.md` and **adopt the rules
     immediately for the current session**. Confirm back to the user already in
     Simplified Technical English.
- **`off` / `cadence` / `status`**: run
  `~/.claude/skills/ste100/scripts/ste100.sh <command> …` and report the result.
  After `off`, return to your normal writing.
- **`uninstall`**: run
  `~/.claude/skills/ste100/scripts/ste100.sh uninstall <--user|--project>` (needs
  `jq`). It unwires **both hooks** (backing up `settings.json` first),
  **restores the status line the installer replaced** (from the saved original),
  and deletes that scope's `ste100.state` and `ste100.cadence`. To drop just the
  badge and keep the rules, run `install.sh`'s counterpart
  `uninstall.sh --statusline-only`. If it warns about a *hand-added* `ste100`
  reference in a `statusLine` command (one the installer didn't manage), tell the
  user to remove that part by hand. The skill's own files stay put; remove them
  with the skills CLI. Return to your normal writing.

## The rules (canonical: `assets/rules.md`)

`assets/rules.md` is the single source of truth the hooks inject. It restates
the intent of the specification in our own words, in the nine sections the
specification uses:

1. **Words.** One word for one thing. One part of speech per word. No slang, no
   idioms, no contractions. Keep articles and keep "that"/"which".
2. **Noun clusters.** Three words maximum. Break longer clusters with
   prepositions.
3. **Verbs.** Infinitive, imperative, simple present, simple past, simple
   future, and past participle as an adjective. Nothing else. No `-ing` forms.
   No present perfect. Active voice.
4. **Sentences.** 20 words maximum in an instruction, 25 in a description. One
   instruction per sentence. Condition first, then the instruction.
5. **Procedures.** Write a step as a command. Start with the verb. Number the
   steps when the order matters.
6. **Descriptive writing.** Six sentences per paragraph maximum. One topic per
   paragraph, stated in the first sentence.
7. **Safety instructions.** Warning *before* the step, never after. State the
   consequence. WARNING for injury, CAUTION for damage, Note for information.
8. **Punctuation and word counts.** Simple punctuation only. No semicolons, no
   dashes for asides, no exclamation marks.
9. **Spelling.** One convention, held consistently. Product names, commands, and
   identifiers spelled exactly as the system spells them.

**Scope.** The rules govern your replies and the prose you author around code:
commit messages, PR descriptions, comments, and documentation. They never govern
the code. Identifiers, logic, string and config values, command syntax, paths,
and error text stay exact.

**Presentation, not reasoning.** Think at whatever length and in whatever style
you need. STE shapes only what you show the user.

**Completeness over brevity for risk.** Section 7 is the rule that outranks
economy: for security warnings and irreversible actions, state every risk fully.
Never soften, hedge, or drop a danger to satisfy a word count. "normal mode" /
"stop ste100" drops the rules for the rest of the session (the persisted setting
changes only via `/ste100 off`).

## Vocabulary

The real specification ships a controlled dictionary: about 900 approved words,
each with one meaning and one part of speech, plus about 1,200 unapproved words
with suggested alternatives. **That dictionary is ASD's property and is not
bundled here.** Get it from <https://www.asd-ste100.org/>.

`assets/word-swaps.md` carries a small table of illustrative swaps
(`follow → obey`, `prior to → before`, `utilize → use`) as a habit-former. The
`SessionStart` hook does not inject it. It prints the file's absolute path so
you can read it on demand.

Technical names and technical verbs stay outside the dictionary by design. Use
the correct term for a part, a tool, a command, a file, or a function.

## Examples

**Explaining.** Before: "The reason your component keeps re-rendering is that
passing an inline object as a prop is creating a brand new reference on every
single render, and since React has been comparing props by reference, the child
is always going to see a change." → STE: "An inline object prop gets a new
reference on each render. React compares props by reference. Thus the child
renders again. Put the object in `useMemo` to keep the reference stable."

**Reporting.** Before: "I've gone ahead and added the token-refresh logic to
`auth.ts`, and I've also been adding error handling, and all of the tests are
now passing." → STE: "I added token refresh to `auth.ts`. The function handles
errors. All tests pass."

**Instructing.** Before: "The temperature should be adjusted prior to commencing
the test, and it is recommended that you verify there are no leaks." → STE:
1. Adjust the temperature.
2. Make sure that there are no leaks.
3. Start the test.

**Warning (STE, and complete).** "WARNING: `git reset --hard` deletes your
uncommitted changes. There is no undo. Commit or stash your work first."

## Status-line badge

`install.sh` wires the badge automatically (default; opt out with
`--no-statusline`). It saves any existing `.statusLine` to
`<scope>/ste100.statusline.orig.json` and points `.statusLine.command` at
`scripts/statusline.sh`. That wrapper runs your saved original with the same
stdin payload and appends `◆ ste100` when the rules resolve on (honouring
project-over-user precedence). When off, the badge is empty, so the line is
exactly your original.

The wrapper is identified by the `STE100_STATUSLINE_ORIG` env-var marker, not by
its basename, so it chains cleanly on top of another skill's status-line wrapper
instead of clobbering it. `uninstall.sh` restores the saved original;
`uninstall.sh --statusline-only` restores it without touching the hooks or state.

The primitive underneath is `ste100.sh statusline`, which prints `◆ ste100` when
on and nothing when off. Call it directly if you prefer to compose the badge
into a status line by hand.

## Directory layout

- `scripts/ste100.sh`: the control surface (state file read/write); `statusline` prints the badge.
- `scripts/session-start.sh`: the `SessionStart` hook (injects the rules).
- `scripts/prompt-reminder.sh`: the `UserPromptSubmit` hook (per-turn reminder, cadence-gated).
- `scripts/statusline.sh`: the status-line wrapper (runs the saved original + appends the badge).
- `scripts/install.sh`: wires both hooks + the badge into `settings.json` (idempotent, backs up).
- `scripts/uninstall.sh`: unwires both hooks, restores the status line, deletes the state and cadence files (idempotent, backs up).
- `assets/rules.md`: the rules the hooks inject.
- `assets/word-swaps.md`: illustrative word replacements, read on demand.
