#!/usr/bin/env bash
# laconic — SessionStart hook.
#
# Reads the persisted state (project overrides user) and, when active, prints
# the mode-filtered register to stdout. Claude Code injects SessionStart stdout
# as hidden session context. Prints nothing when laconic is off or unset — it
# never injects noise.
#
# Wired into settings.json by install.sh (always-on). Also declared in
# SKILL.md frontmatter so it fires when the skill is loaded in context.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RULES="$SCRIPT_DIR/../assets/rules.md"

# Claude Code passes a JSON payload on stdin; we only need the project dir.
# Extract "cwd" without requiring jq; fall back to $CLAUDE_PROJECT_DIR / $PWD.
PAYLOAD="$(cat 2>/dev/null || true)"
CWD="$(printf '%s' "$PAYLOAD" | sed -n 's/.*"cwd"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)"
PROJECT_DIR="${CWD:-${CLAUDE_PROJECT_DIR:-$PWD}}"

read_state() { [ -f "$1" ] && head -n1 "$1" | tr -d '\r\n' || true; }

PROJECT_STATE="$PROJECT_DIR/.claude/laconic.state"
USER_STATE="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/laconic.state"

LINE=""
if [ -n "$(read_state "$PROJECT_STATE")" ]; then
  LINE="$(read_state "$PROJECT_STATE")"
elif [ -n "$(read_state "$USER_STATE")" ]; then
  LINE="$(read_state "$USER_STATE")"
fi

STATE="${LINE%% *}"
MODE="${LINE#* }"
[ "$STATE" = "on" ] || exit 0          # off / unset → inject nothing
case "$MODE" in prose-only|prose+code) ;; *) MODE="prose+code" ;; esac
[ -f "$RULES" ] || exit 0

echo "LACONIC MODE ACTIVE (mode: $MODE). The register below governs how you present"
echo "answers to the user. Follow it until told 'normal mode' or 'stop laconic'."
echo

# Emit rules.md keeping only the active mode's block. Lines inside a
# <!-- mode:X --> … <!-- /mode:X --> region print only when X == MODE; lines
# outside any region always print. Markers themselves are never printed.
awk -v active="$MODE" '
  /<!-- mode:.* -->/ {
    m = $0; sub(/.*<!-- mode:/, "", m); sub(/ -->.*/, "", m);
    skip = (m != active); next
  }
  /<!-- \/mode:.* -->/ { skip = 0; next }
  { if (!skip) print }
' "$RULES"
