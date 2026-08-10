# laconic

Be concise, plain, and complete. Laconic persists that voice per project or
user. It shapes presentation, not reasoning.

## Install

```sh
npx skills add zcaceres/skills -s laconic
~/.claude/skills/laconic/scripts/install.sh # needs jq
/laconic on # user scope, laconic-code (default)
```

The installer wires the session and prompt hooks plus a status-line badge.

## Commands

| Command | Effect |
|---|---|
| `/laconic on [--project] [mode]` | Enable it. |
| `/laconic off [--project]` | Disable it. |
| `/laconic mode <mode> [--project]` | Choose `prose-only`, `prose+code`, or `laconic-code`. |
| `/laconic cadence <N> [--project]` | Remind every Nth turn; `1` is the default. |
| `/laconic status` | Show the resolved state and settings. |
| `/laconic uninstall [--project]` | Remove hooks, badge, and state. |

`laconic-code` prefers a diff, snippet, signature, or file tree when code is
the clearest answer. A project setting overrides a user setting. Say “normal
mode” or “stop laconic” for a session-only override.

## Details

`SKILL.md` documents hook behavior, status-line configuration, and uninstall
options. The canonical voice rules are in `assets/rules.md`.
