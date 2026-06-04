#!/bin/sh
# Picks the right pre-built safety-dotenv-guard binary for the host OS/arch and execs it.
# Reads the tool payload on stdin (Claude Code hook protocol) and forwards
# stdin/stdout/stderr unchanged.

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
BIN_DIR="$DIR/bin"

OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Darwin) BIN="$BIN_DIR/safety-dotenv-guard-darwin-arm64" ;;
  Linux)
    case "$ARCH" in
      x86_64|amd64) BIN="$BIN_DIR/safety-dotenv-guard-linux-x64" ;;
      *) echo "safety-dotenv-guard: unsupported Linux arch: $ARCH" >&2; exit 0 ;;
    esac
    ;;
  *) echo "safety-dotenv-guard: unsupported OS: $OS" >&2; exit 0 ;;
esac

if [ ! -x "$BIN" ]; then
  echo "safety-dotenv-guard: binary not found at $BIN. Run 'bun run build:all' inside the skill or reinstall." >&2
  exit 0
fi

exec "$BIN" "$@"
