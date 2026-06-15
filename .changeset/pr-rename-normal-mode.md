---
"@zcaceres/skill-pr": major
---

Rename the `stacked-pr` skill to `pr` and add a default non-stacked mode.

The command is now `/pr`. The skill has two modes, stored in
`git config pr.mode`:

- **normal** (default) — `/pr` commits your conversation changes, pushes,
  and opens a single PR against the trunk (the former `commit-push-pr`
  flow).
- **stacked** — `/pr` becomes the stacked-PR workflow: `/pr` checkpoints
  the current diff onto a new branch, plus `submit`, `sync`, and
  bottom-up `merge`.

New `/pr setup` subcommand toggles the mode (writes `git config pr.mode`,
global by default). `update`, `log`, and `merge` work in both modes;
`log` and `merge` take a mode-specific path. `checkpoint`, `submit`, and
`sync` are the stacked operations and run regardless of mode when named
explicitly.

The bundled PostToolUse nudge now points at `/pr` and its binary/state
are renamed to `pr-nudge`. `PR_NUDGE_*` env vars are primary;
`STACKED_PR_NUDGE_*` still works as an alias.

Migration: replace `/stacked-pr <sub>` with `/pr <sub>`. To keep the
stacked workflow as your default everywhere, run
`git config --global pr.mode stacked`.
