#!/usr/bin/env bash
# laconic: UserPromptSubmit hook.
#
# Fires on every user turn. When laconic is on, prints a one-line reminder that
# refocuses the model on the voice, then stops. Claude Code injects
# UserPromptSubmit stdout as context, right before the user's message, the
# highest-attention slot in the window. Prints nothing when laconic is off or
# unset, so it never adds noise.
#
# The reminder is a restatement, not a detector. The persisted SessionStart
# voice decays over a long session; this pulls the model back each turn without
# re-injecting the full rules. It reads the same state as session-start.sh
# (project overrides user) and names the active mode so the reminder matches it.
#
# Wired into settings.json by install.sh (always-on). Also declared in SKILL.md
# frontmatter so it fires when the skill is loaded in context.

set -euo pipefail

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
case "$MODE" in prose-only|prose+code|laconic-code) ;; *) MODE="prose+code" ;; esac

# Cadence: N turns between reminders, 1 = every turn (default). Resolved
# project-over-user from laconic.cadence, independent of the state file.
CADENCE="$(read_state "$PROJECT_DIR/.claude/laconic.cadence")"
[ -n "$CADENCE" ] || CADENCE="$(read_state "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/laconic.cadence")"
case "$CADENCE" in ''|*[!0-9]*) CADENCE=1 ;; esac
[ "$CADENCE" -ge 1 ] 2>/dev/null || CADENCE=1

# For N > 1, count turns per session so the cadence is stable across the
# conversation. session_id comes from the payload. Without it we can't count, so
# fall back to reminding every turn rather than going silent. Emit on turns
# 1, 1+N, 1+2N, …: a fresh reminder at the start, then every Nth after.
if [ "$CADENCE" -gt 1 ]; then
  SESSION_ID="$(printf '%s' "$PAYLOAD" | sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)"
  if [ -n "$SESSION_ID" ]; then
    CDIR="${TMPDIR:-/tmp}/laconic-turn-counters"
    mkdir -p "$CDIR" 2>/dev/null || true
    find "$CDIR" -type f -mtime +2 -delete 2>/dev/null || true   # prune stale sessions
    CFILE="$CDIR/$SESSION_ID"
    COUNT="$(read_state "$CFILE")"; case "$COUNT" in ''|*[!0-9]*) COUNT=0 ;; esac
    COUNT=$((COUNT + 1))
    printf '%s\n' "$COUNT" > "$CFILE.tmp" 2>/dev/null && mv "$CFILE.tmp" "$CFILE" 2>/dev/null || true
    [ $(( (COUNT - 1) % CADENCE )) -eq 0 ] || exit 0
  fi
fi

echo "Reminder to follow the $MODE laconic rules: lead with the point, answer at the size the question asks, then stop. No preamble. No survey of options unless asked. Concise sentences, no em-dashes or asides."
