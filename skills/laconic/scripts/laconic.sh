#!/usr/bin/env bash
# laconic — control surface for the laconic register.
#
# Reads/writes a tiny state file ("<on|off> <mode>") at project or user scope.
# The SessionStart hook (session-start.sh) reads that state and injects the
# register when active; this script never prints the register itself.
#
# Usage:
#   laconic.sh on   [--project|--user] [prose-only|prose+code]
#   laconic.sh off  [--project|--user]
#   laconic.sh mode <prose-only|prose+code> [--project|--user]
#   laconic.sh status
#   laconic.sh statusline   # compact badge for a status line ("◆ laconic" when on, else nothing)
#
# Defaults: scope = user; mode = prose+code.
# Precedence: a project state file overrides the user one (so a project `off`
# suppresses a user `on`).

set -euo pipefail

VALID_MODES="prose-only prose+code"
DEFAULT_MODE="prose+code"

user_state()    { echo "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/laconic.state"; }
project_state() { echo "${CLAUDE_PROJECT_DIR:-$PWD}/.claude/laconic.state"; }

is_mode() { case " $VALID_MODES " in *" $1 "*) return 0 ;; *) return 1 ;; esac; }

# First line of a state file ("<state> <mode>"), or empty if absent.
read_state() { [ -f "$1" ] && head -n1 "$1" | tr -d '\r\n' || true; }

write_state() {
  local file="$1" state="$2" mode="$3"
  mkdir -p "$(dirname "$file")"
  printf '%s %s\n' "$state" "$mode" > "$file.tmp"
  mv "$file.tmp" "$file"
}

# Effective "<src> <state> <mode>", honouring project-over-user precedence.
resolve() {
  local proj user
  proj="$(read_state "$(project_state)")"
  if [ -n "$proj" ]; then echo "project $proj"; return; fi
  user="$(read_state "$(user_state)")"
  if [ -n "$user" ]; then echo "user $user"; return; fi
  echo "none off $DEFAULT_MODE"
}

cmd="${1:-status}"; shift || true

scope="user"
mode=""
for arg in "$@"; do
  case "$arg" in
    --project) scope="project" ;;
    --user)    scope="user" ;;
    prose-only|prose+code) mode="$arg" ;;
    *) echo "laconic: unexpected argument: $arg" >&2; exit 2 ;;
  esac
done

target_file() { if [ "$scope" = "project" ]; then project_state; else user_state; fi; }

case "$cmd" in
  on)
    file="$(target_file)"
    if [ -z "$mode" ]; then                 # keep the existing mode, else default
      existing="$(read_state "$file")"; mode="${existing#* }"
      is_mode "$mode" || mode="$DEFAULT_MODE"
    fi
    write_state "$file" on "$mode"
    echo "laconic on ($scope, $mode) → $file"
    ;;
  off)
    # Write an explicit `off` (rather than deleting) so a project-scope off can
    # override a user-scope on.
    file="$(target_file)"
    existing="$(read_state "$file")"; emode="${existing#* }"
    is_mode "$emode" || emode="$DEFAULT_MODE"
    write_state "$file" off "$emode"
    echo "laconic off ($scope) → $file"
    ;;
  mode)
    [ -n "$mode" ] || { echo "laconic: mode requires prose-only|prose+code" >&2; exit 2; }
    file="$(target_file)"
    existing="$(read_state "$file")"; estate="${existing%% *}"
    [ "$estate" = "on" ] || estate="off"
    write_state "$file" "$estate" "$mode"
    echo "laconic mode=$mode ($scope, $estate) → $file"
    ;;
  status)
    read -r src state smode <<EOF
$(resolve)
EOF
    if [ "$src" = "none" ]; then
      echo "laconic: inactive (no state file). Default mode when enabled: $DEFAULT_MODE."
    else
      echo "laconic: $state (mode: $smode) — resolved from $src scope"
      echo "  project: '$(read_state "$(project_state)")'  [$(project_state)]"
      echo "  user:    '$(read_state "$(user_state)")'  [$(user_state)]"
    fi
    ;;
  statusline)
    # Compact badge for embedding in a status line. Prints nothing (and no
    # trailing newline) when laconic is off/unset, so callers can splice it in
    # unconditionally. Honours project-over-user precedence via resolve().
    read -r src state smode <<EOF
$(resolve)
EOF
    [ "$state" = "on" ] && printf '◆ laconic' || true
    ;;
  -h|--help)
    sed -n '2,19p' "$0" | sed 's/^# \{0,1\}//'
    ;;
  *)
    echo "laconic: unknown command: $cmd (use on|off|mode|status)" >&2
    exit 2
    ;;
esac
