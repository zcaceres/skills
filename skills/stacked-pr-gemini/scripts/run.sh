#!/bin/sh
# Picks the right pre-built stacked-pr-gemini-nudge binary for the host OS/arch and execs it.
# Reads the Bash command payload on stdin (Gemini CLI hook protocol) and forwards
# stdin/stdout/stderr unchanged.

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
BIN_DIR="$DIR/bin"

OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Darwin) BIN="$BIN_DIR/stacked-pr-gemini-nudge-darwin-arm64" ;;
  Linux)
    case "$ARCH" in
      x86_64|amd64) BIN="$BIN_DIR/stacked-pr-gemini-nudge-linux-x64" ;;
      *) echo "stacked-pr-gemini-nudge: unsupported Linux arch: $ARCH" >&2; exit 0 ;;
    esac
    ;;
  *) echo "stacked-pr-gemini-nudge: unsupported OS: $OS" >&2; exit 0 ;;
esac

if [ ! -x "$BIN" ]; then
  echo "stacked-pr-gemini-nudge: binary not found at $BIN. Run 'bun run build:all' inside the skill or reinstall." >&2
  exit 0
fi

exec "$BIN" "$@"
