# @zcaceres/skill-pr-size-nudge

## 1.0.0

### Major Changes

- Initial release: Claude Code PostToolUse hook that injects a soft
  system-reminder when the uncommitted diff in the current repo crosses
  size/file thresholds (defaults: 300 lines OR 8 files). Tells the agent
  to consider `/checkpoint` to land the slice as a stacked PR.

  Non-blocking by design — never exits non-zero, never returns block
  payloads. Reads `git diff --numstat HEAD` + `git status --porcelain`
  under a 300 ms subprocess timeout; state is kept in
  `~/.claude/state/pr-size-nudge.json` with a 30-minute cooldown and
  re-fire deltas (+150 lines / +3 files).

  Default exclusions: lockfiles (`bun.lock`, `package-lock.json`,
  `Cargo.lock`, etc.), `dist/**`, `build/**`, `*.min.js`, `*.min.css`,
  `*.snap`. Override via `PR_NUDGE_EXCLUDE` and `PR_NUDGE_SKIP_ROOTS`.

  Ships pre-built standalone binaries for macOS arm64, Linux x64, and
  Windows x64. Ported from
  [`zcaceres/claude-stacked-prs/src/pr-size-nudge.ts`](https://github.com/zcaceres/claude-stacked-prs/blob/main/src/pr-size-nudge.ts)
  with source and tests preserved verbatim.
