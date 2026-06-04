#!/bin/sh
# Picks the right pre-built safety-op-creds binary for the host OS/arch and execs it.
# Reads the tool payload on stdin (Claude Code hook protocol) and forwards
# stdin/stdout/stderr unchanged.

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
BIN_DIR="$DIR/bin"

OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Darwin)
    case "$ARCH" in
      arm64) BIN="$BIN_DIR/safety-op-creds-darwin-arm64" ;;
      x86_64) BIN="$BIN_DIR/safety-op-creds-darwin-x64" ;;
      *) echo "safety-op-creds: SKILL DISABLED — unsupported Darwin arch '$ARCH'. Bash tool calls will NOT be screened for op-secret leaks." >&2; exit 0 ;;
    esac
    ;;
  Linux)
    case "$ARCH" in
      x86_64|amd64) BIN="$BIN_DIR/safety-op-creds-linux-x64" ;;
      aarch64|arm64) BIN="$BIN_DIR/safety-op-creds-linux-arm64" ;;
      *) echo "safety-op-creds: SKILL DISABLED — unsupported Linux arch '$ARCH'. Bash tool calls will NOT be screened for op-secret leaks." >&2; exit 0 ;;
    esac
    ;;
  *) echo "safety-op-creds: SKILL DISABLED — unsupported OS '$OS'. Bash tool calls will NOT be screened for op-secret leaks." >&2; exit 0 ;;
esac

if [ ! -x "$BIN" ]; then
  echo "safety-op-creds: SKILL DISABLED — binary not found at $BIN. Bash tool calls will NOT be screened. Run 'bun run build:all' inside the skill or reinstall." >&2
  exit 0
fi

exec "$BIN" "$@"
