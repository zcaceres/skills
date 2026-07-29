#!/usr/bin/env bash
# ste100: SessionStart hook.
#
# Reads the persisted state (project overrides user) and, when active, prints
# the ASD-STE100 writing rules to stdout. Claude Code injects SessionStart
# stdout as hidden session context. Prints nothing when ste100 is off or unset.
# It never injects noise.
#
# The word-swap table is not injected. It is large and only needed on demand,
# so the rules point at its absolute path instead.
#
# Wired into settings.json by install.sh (always-on). Also declared in
# SKILL.md frontmatter so it fires when the skill is loaded in context.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RULES="$SCRIPT_DIR/../assets/rules.md"
SWAPS="$SCRIPT_DIR/../assets/word-swaps.md"

# Claude Code passes a JSON payload on stdin; we only need the project dir.
# Extract "cwd" without requiring jq; fall back to $CLAUDE_PROJECT_DIR / $PWD.
PAYLOAD="$(cat 2>/dev/null || true)"
CWD="$(printf '%s' "$PAYLOAD" | sed -n 's/.*"cwd"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)"
PROJECT_DIR="${CWD:-${CLAUDE_PROJECT_DIR:-$PWD}}"

read_state() { [ -f "$1" ] && head -n1 "$1" | tr -d '\r\n' || true; }

PROJECT_STATE="$PROJECT_DIR/.claude/ste100.state"
USER_STATE="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/ste100.state"

STATE=""
if [ -n "$(read_state "$PROJECT_STATE")" ]; then
  STATE="$(read_state "$PROJECT_STATE")"
elif [ -n "$(read_state "$USER_STATE")" ]; then
  STATE="$(read_state "$USER_STATE")"
fi

[ "$STATE" = "on" ] || exit 0          # off / unset → inject nothing
[ -f "$RULES" ] || exit 0

echo "STE100 MODE ACTIVE. Write everything you present to the user in ASD-STE100"
echo "Simplified Technical English. The rules below govern how you write."
echo "Follow them until told 'normal mode' or 'stop ste100'."
echo

cat "$RULES"

if [ -f "$SWAPS" ]; then
  echo
  echo "Word-swap table (read it when you need a replacement word): $SWAPS"
fi
