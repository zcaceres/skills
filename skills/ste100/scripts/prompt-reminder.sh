#!/usr/bin/env bash
# ste100: UserPromptSubmit hook.
#
# Fires on every user turn. When ste100 is on, prints a one-line reminder that
# refocuses the model on the writing rules, then stops. Claude Code injects
# UserPromptSubmit stdout as context, right before the user's message, the
# highest-attention slot in the window. Prints nothing when ste100 is off or
# unset, so it never adds noise.
#
# The reminder is a restatement, not a detector. The persisted SessionStart
# rules decay over a long session; this pulls the model back each turn without
# re-injecting the full rules. It reads the same state as session-start.sh
# (project overrides user).
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

PROJECT_STATE="$PROJECT_DIR/.claude/ste100.state"
USER_STATE="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/ste100.state"

STATE=""
if [ -n "$(read_state "$PROJECT_STATE")" ]; then
  STATE="$(read_state "$PROJECT_STATE")"
elif [ -n "$(read_state "$USER_STATE")" ]; then
  STATE="$(read_state "$USER_STATE")"
fi

[ "$STATE" = "on" ] || exit 0          # off / unset → inject nothing

# Cadence: N turns between reminders, 1 = every turn (default). Resolved
# project-over-user from ste100.cadence, independent of the state file.
CADENCE="$(read_state "$PROJECT_DIR/.claude/ste100.cadence")"
[ -n "$CADENCE" ] || CADENCE="$(read_state "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/ste100.cadence")"
case "$CADENCE" in ''|*[!0-9]*) CADENCE=1 ;; esac
[ "$CADENCE" -ge 1 ] 2>/dev/null || CADENCE=1

# For N > 1, count turns per session so the cadence is stable across the
# conversation. session_id comes from the payload. Without it we can't count, so
# fall back to reminding every turn rather than going silent. Emit on turns
# 1, 1+N, 1+2N, …: a fresh reminder at the start, then every Nth after.
if [ "$CADENCE" -gt 1 ]; then
  SESSION_ID="$(printf '%s' "$PAYLOAD" | sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)"
  if [ -n "$SESSION_ID" ]; then
    CDIR="${TMPDIR:-/tmp}/ste100-turn-counters"
    mkdir -p "$CDIR" 2>/dev/null || true
    find "$CDIR" -type f -mtime +2 -delete 2>/dev/null || true   # prune stale sessions
    CFILE="$CDIR/$SESSION_ID"
    COUNT="$(read_state "$CFILE")"; case "$COUNT" in ''|*[!0-9]*) COUNT=0 ;; esac
    COUNT=$((COUNT + 1))
    printf '%s\n' "$COUNT" > "$CFILE.tmp" 2>/dev/null && mv "$CFILE.tmp" "$CFILE" 2>/dev/null || true
    [ $(( (COUNT - 1) % CADENCE )) -eq 0 ] || exit 0
  fi
fi

echo "Reminder to follow the ASD-STE100 rules: one word for one thing, active voice, simple tenses, no -ing forms. Max 20 words in an instruction and 25 in a description. One instruction per sentence. Put the condition first and the warning before the step. Code, identifiers, and error text stay exact."
