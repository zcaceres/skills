#!/usr/bin/env bash
# laconic status-line wrapper.
#
# install.sh sets this as a settings.json `.statusLine.command`. It reads the
# Claude Code status JSON on stdin, runs the wrapped original status-line command
# (saved by install.sh) with that same JSON, and appends the laconic badge
# ("◆ laconic") when the voice resolves on for the workspace. When the voice is
# off the badge is empty, so the line is exactly the original — the wrapper is
# invisible until you turn laconic on.
#
# Env:
#   LACONIC_STATUSLINE_ORIG  path to the saved original `.statusLine` JSON that
#                            install.sh wrote. Absent/empty/null → badge only.
#
# Requires: jq (same dependency as install.sh).

set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
payload="$(cat)"

# Run the wrapped original status-line command, if one was saved, feeding it the
# same JSON payload we received. Failures degrade to an empty original rather
# than breaking the status line.
orig_out=""
orig_file="${LACONIC_STATUSLINE_ORIG:-}"
if [ -n "$orig_file" ] && [ -f "$orig_file" ]; then
  orig_cmd="$(jq -r '.command // empty' "$orig_file" 2>/dev/null || true)"
  if [ -n "$orig_cmd" ]; then
    orig_out="$(printf '%s' "$payload" | eval "$orig_cmd" 2>/dev/null || true)"
  fi
fi

# Resolve scope against the workspace dir in the payload so project-over-user
# precedence matches the directory the status line describes.
cwd="$(printf '%s' "$payload" | jq -r '.workspace.current_dir // empty' 2>/dev/null || true)"
badge="$(CLAUDE_PROJECT_DIR="$cwd" "$here/laconic.sh" statusline 2>/dev/null || true)"

if [ -n "$orig_out" ] && [ -n "$badge" ]; then
  printf '%s  %s' "$orig_out" "$badge"
elif [ -n "$badge" ]; then
  printf '%s' "$badge"
else
  printf '%s' "$orig_out"
fi
