# @zcaceres/skill-laconic

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
