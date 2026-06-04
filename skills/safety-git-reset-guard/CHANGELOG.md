# @zcaceres/skill-safety-git-reset-guard

## 1.0.0

### Major Changes

- Initial release: PreToolUse hook for Claude Code that blocks destructive
  git commands (`reset --hard`, `push --force`, `clean -f`, `checkout <path>`,
  `branch -D`, `stash drop/clear`, `worktree remove --force`) while letting
  safer alternatives (`--force-with-lease`, `--soft/--mixed`, `restore`,
  `branch -d`) through. Ships pre-built standalone binaries for macOS arm64,
  Linux x64, and Windows x64.

  Ported from
  [`zcaceres/claude-git-reset`](https://github.com/zcaceres/claude-git-reset)
  with behavior and test coverage preserved.
