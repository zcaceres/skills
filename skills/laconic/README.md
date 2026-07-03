# laconic

Answer in a spare, plain voice: lead with the point, complete sentences, no
filler or hedging. Persisted per project or per user, in prose-only, prose+code,
or laconic-code (code-first) mode. Plain English made economical, not clipped
fragments.

## Layout

- `SKILL.md`: manifest + instructions (skills.sh standard)
- `scripts/laconic.sh`: control surface for on/off/mode/status/uninstall (writes a state file)
- `scripts/session-start.sh`: SessionStart hook that injects the voice when active
- `scripts/statusline.sh`: status-line wrapper (runs your saved original + appends the badge)
- `scripts/install.sh`: wires the hook + status-line badge into `settings.json` (idempotent, backs up)
- `scripts/uninstall.sh`: unwires the hook, restores the status line, deletes the state file (idempotent, backs up)
- `assets/rules.md`: the voice the hook injects

## Install

```sh
npx skills add zcaceres/skills -s laconic
~/.claude/skills/laconic/scripts/install.sh        # wire the SessionStart hook (needs jq)
```

Then enable it:

```sh
/laconic on                 # user scope, prose+code (defaults)
/laconic on --project prose-only
/laconic mode laconic-code   # reply primarily in code
/laconic status
/laconic off
```

Why the second step: the `skills` CLI only copies files. The SKILL.md
frontmatter `hooks:` block fires only while the skill is active in context;
`install.sh` gets the `SessionStart` hook onto every session so the voice
persists. Use `--project` for `./.claude/settings.json` or `--target PATH` for an
explicit file. The script self-locates, so it works at user or project scope.

## Uninstall

```sh
/laconic uninstall             # user scope: unwire the hook + delete laconic.state
/laconic uninstall --project   # same for ./.claude/settings.json
```

`uninstall.sh` is the exact inverse of `install.sh` (same flags, needs `jq`): it
backs up `settings.json`, removes the laconic `SessionStart` hook while leaving
other hooks intact, restores the status line it replaced (from the saved
original), and deletes that scope's state file. It's idempotent, and it warns
rather than silently breaking if a *hand-added* `statusLine` reference to
laconic (one it didn't manage) remains. Pass `--keep-state` to unwire the hook
but keep `laconic.state`, or `--statusline-only` to restore just the status line
and keep the voice. The skill's own files stay put; remove them with your skills CLI.

## Notes

- **Modes.** `prose-only` shapes conversational replies. `prose+code` (default)
  also tightens commit messages, PR descriptions, and code comments, never the
  code itself. `laconic-code` replies primarily *in* code: a snippet is the
  message and prose only frames it, kept modest. It keeps prose+code's artifact
  rules and never compresses the code.
- **Scope precedence.** A project state file overrides the user one, so a project
  `off` suppresses a user `on`.
- **Presentation, not reasoning.** The voice only shapes what the agent shows
  you; it never constrains the agent's reasoning. Full clarity is preserved for
  security warnings, irreversible actions, and genuine ambiguity.
- **Status-line badge.** `install.sh` adds it by default: it saves your existing
  `.statusLine`, then routes it through `statusline.sh`, which re-runs your
  original and appends `◆ laconic` when on (nothing when off). Opt out with
  `install.sh --no-statusline`; remove later with `uninstall.sh --statusline-only`.
  The underlying primitive is `laconic.sh statusline`. See SKILL.md.
