# @zcaceres/skill-laconic

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
