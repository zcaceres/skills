# ste100

Write in [ASD-STE100 Simplified Technical English](https://www.asd-ste100.org/):
one word for one thing, active voice, simple tenses, short sentences, one
instruction per sentence. Persisted per project or per user. Plain English made
unambiguous, not clipped.

## Layout

- `SKILL.md`: manifest + instructions (skills.sh standard)
- `scripts/ste100.sh`: control surface for on/off/cadence/status/uninstall (writes a state file)
- `scripts/session-start.sh`: SessionStart hook that injects the rules when active
- `scripts/prompt-reminder.sh`: UserPromptSubmit hook that restates the rules each turn (cadence-gated)
- `scripts/statusline.sh`: status-line wrapper (runs your saved original + appends the badge)
- `scripts/install.sh`: wires both hooks + the status-line badge into `settings.json` (idempotent, backs up)
- `scripts/uninstall.sh`: unwires both hooks, restores the status line, deletes the state file (idempotent, backs up)
- `assets/rules.md`: the rules the hooks inject
- `assets/word-swaps.md`: illustrative word replacements, read on demand

## Install

```sh
npx skills add zcaceres/skills -s ste100
~/.claude/skills/ste100/scripts/install.sh        # wire both hooks (needs jq)
```

Then enable it:

```sh
/ste100 on                  # user scope
/ste100 on --project
/ste100 cadence 3           # remind every 3rd turn (1 = every turn, default)
/ste100 status
/ste100 off
```

Why the second step: the `skills` CLI only copies files. The SKILL.md
frontmatter `hooks:` block fires only while the skill is active in context;
`install.sh` gets both hooks onto every session so the rules persist. Use
`--project` for `./.claude/settings.json` or `--target PATH` for an explicit
file. The script self-locates, so it works at user or project scope.

## Uninstall

```sh
/ste100 uninstall             # user scope: unwire both hooks + delete ste100.state
/ste100 uninstall --project   # same for ./.claude/settings.json
```

`uninstall.sh` is the exact inverse of `install.sh` (same flags, needs `jq`): it
backs up `settings.json`, removes the ste100 `SessionStart` and
`UserPromptSubmit` hooks while leaving other hooks intact, restores the status
line it replaced (from the saved original), and deletes that scope's state and
cadence files. It's idempotent, and it warns rather than silently breaking if a
*hand-added* `statusLine` reference to ste100 (one it didn't manage) remains.
Pass `--keep-state` to unwire the hooks but keep `ste100.state`, or
`--statusline-only` to restore just the status line and keep the rules. The
skill's own files stay put; remove them with your skills CLI.

## What the rules cover

The specification has 53 writing rules in nine sections. `assets/rules.md`
restates their intent:

1. **Words** — one word for one thing, one part of speech per word, no slang or
   contractions, keep articles
2. **Noun clusters** — three words maximum
3. **Verbs** — infinitive, imperative, simple present/past/future, past
   participle as an adjective; no `-ing` forms, no present perfect, active voice
4. **Sentences** — 20 words in an instruction, 25 in a description; one
   instruction per sentence; condition first
5. **Procedures** — steps as commands, verb first, numbered when ordered
6. **Descriptive writing** — six sentences per paragraph, one topic each
7. **Safety instructions** — warning before the step, state the consequence
8. **Punctuation and word counts** — simple punctuation, no semicolons or asides
9. **Spelling** — one convention, held

## Notes

- **On or off.** No modes. The rules apply to your replies and to the prose you
  author around code (commit messages, PR descriptions, comments, docs). They
  never apply to the code itself: identifiers, logic, values, command syntax,
  and error text stay exact.
- **Two hooks.** `SessionStart` injects the full rules at session start and after
  each compaction. `UserPromptSubmit` restates them before a turn to counter
  mid-session drift. Both stay silent while ste100 is off.
- **Cadence.** `/ste100 cadence <N>` fires the per-turn reminder every Nth turn.
  `1` (default) is every turn. It lives in its own `ste100.cadence` file and
  resolves project-over-user, like the on/off state.
- **Scope precedence.** A project state file overrides the user one, so a project
  `off` suppresses a user `on`.
- **Presentation, not reasoning.** The rules only shape what the agent shows you;
  they never constrain the agent's reasoning. Section 7 outranks brevity: for
  security warnings and irreversible actions, every risk is stated in full.
- **The dictionary is not bundled.** ASD-STE100's ~900 approved and ~1,200
  unapproved words are ASD's property. Get the specification from
  <https://www.asd-ste100.org/>. `assets/word-swaps.md` carries only a small
  illustrative swap table as a habit-former.
- **Status-line badge.** `install.sh` adds it by default: it saves your existing
  `.statusLine`, then routes it through `statusline.sh`, which re-runs your
  original and appends `◆ ste100` when on (nothing when off). Opt out with
  `install.sh --no-statusline`; remove later with `uninstall.sh --statusline-only`.
  The underlying primitive is `ste100.sh statusline`. See SKILL.md.
