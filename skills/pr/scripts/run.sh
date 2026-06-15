#!/bin/sh
# Picks the right pre-built pr-nudge binary for the host OS/arch and execs it.
# Reads the Bash command payload on stdin (Claude Code hook protocol) and forwards
# stdin/stdout/stderr unchanged.

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
BIN_DIR="$DIR/bin"

OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Darwin) BIN="$BIN_DIR/pr-nudge-darwin-arm64" ;;
  Linux)
    case "$ARCH" in
      x86_64|amd64) BIN="$BIN_DIR/pr-nudge-linux-x64" ;;
      *) echo "pr-nudge: unsupported Linux arch: $ARCH" >&2; exit 0 ;;
    esac
    ;;
  *) echo "pr-nudge: unsupported OS: $OS" >&2; exit 0 ;;
esac

if [ ! -x "$BIN" ]; then
  echo "pr-nudge: binary not found at $BIN. Run 'bun run build:all' inside the skill or reinstall." >&2
  exit 0
fi

exec "$BIN" "$@"
