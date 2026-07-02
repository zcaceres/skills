# laconic

Answer in a spare, plain voice — lead with the point, complete sentences, no
filler or hedging. Persisted per project or per user, in prose-only or prose+code
mode. Plain English made economical, not clipped fragments.

## Layout

- `SKILL.md` — manifest + instructions (skills.sh standard)
- `scripts/laconic.sh` — control surface: on/off/mode/status (writes a state file)
- `scripts/session-start.sh` — SessionStart hook that injects the voice when active
- `scripts/install.sh` — wires the hook into `settings.json` (idempotent, backs up)
- `assets/rules.md` — the voice the hook injects

## Install

```sh
npx skills add zcaceres/skills -s laconic
~/.claude/skills/laconic/scripts/install.sh        # wire the SessionStart hook (needs jq)
```

Then enable it:

```sh
/laconic on                 # user scope, prose+code (defaults)
/laconic on --project prose-only
/laconic status
/laconic off
```

Why the second step: the `skills` CLI only copies files. The SKILL.md
frontmatter `hooks:` block fires only while the skill is active in context;
`install.sh` gets the `SessionStart` hook onto every session so the voice
persists. Use `--project` for `./.claude/settings.json` or `--target PATH` for an
explicit file. The script self-locates, so it works at user or project scope.

## Notes

- **Modes.** `prose-only` shapes conversational replies. `prose+code` (default)
  also tightens commit messages, PR descriptions, and code comments — never the
  code itself.
- **Scope precedence.** A project state file overrides the user one, so a project
  `off` suppresses a user `on`.
- **Presentation, not reasoning.** The voice only shapes what the agent shows
  you; it never constrains the agent's reasoning. Full clarity is preserved for
  security warnings, irreversible actions, and genuine ambiguity.
- **Status-line badge.** `laconic.sh statusline` prints `◆ laconic` when on
  (nothing when off), so you can splice it into your `settings.json` `statusLine`
  command to see at a glance that the voice is active. See SKILL.md.
