# @zcaceres/skill-safety-rm-rf-guard

## 1.0.0

### Major Changes

- Initial release: PreToolUse hook for Claude Code that blocks destructive
  file deletion (`rm`, `shred`, `unlink`, `find -delete`, sudo/xargs/subshell
  variants) and redirects the agent to the `trash` CLI. Ships pre-built
  standalone binaries for macOS arm64, Linux x64, and Windows x64.

  Ported from
  [`zcaceres/claude-rm-rf`](https://github.com/zcaceres/claude-rm-rf) with
  behavior and test coverage preserved.
