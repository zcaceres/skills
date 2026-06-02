# @zcaceres/skill-dont-read-dot-env

## 1.0.0

### Major Changes

- Initial release: PreToolUse hook for Claude Code that blocks `Read`,
  `Bash`, `Grep`, and `Glob` tool calls targeting `.env` files so secrets
  never enter the agent's context. Allows template files (`.env.example`,
  `.env.sample`, `.env.template`, `.env.dist`) which are designed to be
  checked into source control. Ships pre-built standalone binaries for
  macOS arm64, Linux x64, and Windows x64.
