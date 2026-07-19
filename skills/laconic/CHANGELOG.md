# @zcaceres/skill-laconic

## 0.7.0

### Minor Changes

- 22aeef0: Status-line badge now names the code mode: `laconic.sh statusline` prints
  `◆ laconic-code` when the resolved mode is `laconic-code`, and `◆ laconic`
  for the prose modes. Off/unset still prints nothing, so the injected line
  makes it clear at a glance when you're in code-first mode.

## 0.6.0

### Minor Changes

- 7bfd9f0: Add a per-turn reminder to counter mid-session drift. A new `UserPromptSubmit`
  hook restates the voice before each turn, so the rules stay near the top of the
  context instead of decaying as the conversation grows.

  Its cadence is configurable: `/laconic cadence <N>` fires the reminder every Nth
  turn (1 = every turn, the default). The setting lives in its own `laconic.cadence`
  file and resolves project-over-user, like the on/off state. `install.sh`,
  `uninstall.sh`, and `status` all learn about the second hook and the cadence.

  Also sharpen the voice rules the hooks inject: add a "right-size the reply" rule
  that rejects answering a plain question with a survey of options in headers and
  tables, since verbosity, not diction, is the main way the voice slips.

## 0.5.0

### Minor Changes

- 8105166: Add a third mode, `laconic-code`. In this mode the voice replies primarily _in_
  code: a snippet is the message, and prose only frames it, kept modest. Use it to
  show a bug, a design, an architecture, or finished work as a diff, before/after,
  signature, or file tree. It keeps prose+code's artifact rules and never
  compresses the code, and it still uses words when they're genuinely clearer (a
  risk, a tradeoff, a why).

  Enable it with `/laconic on laconic-code` or `/laconic mode laconic-code`. The
  `SessionStart` hook's mode filter now also accepts a comma-separated mode list on
  a `<!-- mode:a,b -->` region marker, so the prose examples stay scoped to the
  prose modes while the code-first examples show only in `laconic-code`.

## 0.4.1

### Patch Changes

- 1322e96: Ban em-dashes and asides from the voice. New rule: no em-dashes, no parenthetical
  or appositive asides. Give each fact its own sentence, or cut it. Also swept the
  stray em-dashes out of the skill's own text (`assets/rules.md`, `SKILL.md`,
  `README.md`, and the script comments and runtime messages) so the skill practices
  its own rule. The one exception is the "Dense" bad example in `rules.md`, which
  keeps its em-dashes to show what gets cut.

## 0.4.0

### Minor Changes

- 60ffccf: install.sh now wires the status-line badge by default. It saves any existing
  `.statusLine` and routes it through a new `statusline.sh` wrapper that runs your
  original status line and appends `◆ laconic` when the voice is on (invisible when
  off). Opt out with `install.sh --no-statusline`. `uninstall.sh` restores the
  saved original; `uninstall.sh --statusline-only` restores it without touching the
  hook or state. Wiring is idempotent.

## 0.3.0

### Minor Changes

- 5cc9aaa: Add an uninstall command. `/laconic uninstall [--project|--user]` (and
  `scripts/uninstall.sh`) reverses the install for a scope: it unwires the
  `SessionStart` hook from `settings.json` (backing the file up first), prunes any
  now-empty hook blocks while leaving unrelated hooks intact, and deletes that
  scope's `laconic.state`. Idempotent, and it warns instead of silently breaking a
  `statusLine` command that still references laconic. Pass `--keep-state` to unwire
  the hook without deleting state.

## 0.2.1

### Patch Changes

- 676cd64: Sharpen the laconic examples and keep the voice on for warnings. The
  "Explaining" and "Reporting" laconic rewrites are tighter, so the contrast with
  the wordy versions is starker. The old "full clarity" override — which dropped the
  voice entirely for warnings — is gone: for risks and irreversible actions the
  voice now stays on, but completeness wins over brevity (state every danger
  fully, never soften or omit it to save words). Updated in both `SKILL.md` and
  `assets/rules.md`.

## 0.2.0

### Minor Changes

- b2e09b6: Add a `statusline` subcommand that prints a compact `◆ laconic` badge when the
  register is on (honouring project-over-user precedence) and nothing when it's
  off, so it can be spliced into a `settings.json` `statusLine` command
  unconditionally to show at a glance that the register is active. SKILL.md and
  README document how to wire it in.

### Patch Changes

- 15f8041: Include the `clear` SessionStart source in the hook matcher. Previously the
  matcher was `startup|resume|compact`, so running `/clear` did not re-inject the
  register and the laconic voice silently dropped until the next startup, resume,
  or compaction. The matcher is now `startup|resume|clear|compact` in both the
  `SKILL.md` frontmatter and `install.sh`.

## 0.1.0

### Minor Changes

- e42a258: Add the `laconic` skill: a persistent, plain-spoken terse register — economical
  full sentences, not clipped fragments — toggled per project or per user
  via `/laconic on|off|mode|status`, with `prose-only` and `prose+code` modes. A
  `SessionStart` hook injects the mode-filtered register at the start of each
  session (and after context compaction); `install.sh` wires it into
  `settings.json`. The register governs presentation only, never reasoning, and
  keeps full clarity for security warnings, irreversible actions, and genuine
  ambiguity.
