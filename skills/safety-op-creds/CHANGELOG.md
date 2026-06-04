# @zcaceres/skill-safety-op-creds

## 0.0.0

### Initial Release

- `with-creds` bash wrapper that fetches secrets from 1Password via the
  `op` CLI and exposes them to a target program as either env vars (via
  `op run --env-file`) or `/dev/fd/N` paths (via bash process
  substitution). Secrets never land on disk.
- PreToolUse hook that blocks bare `op read`, `op item get --reveal`,
  and `op item get --format json` so secrets never enter the agent's
  context. Allows `op read` inside `<( ... )` process substitution,
  `op run`, the bundled `with-creds` wrapper, and read-only `op`
  subcommands (`signin`, `whoami`, `vault list`, `item list`).
- Ships pre-built standalone binaries for macOS arm64, Linux x64, and
  Windows x64.
- Scoped to interactive biometric auth via the 1Password macOS app for
  v1. Service-account and Connect-server flows are out of scope.
