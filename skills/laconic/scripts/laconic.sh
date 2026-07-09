#!/usr/bin/env bash
# laconic: control surface for the laconic voice.
#
# Reads/writes a tiny state file ("<on|off> <mode>") at project or user scope.
# The SessionStart hook (session-start.sh) reads that state and injects the
# voice when active; this script never prints the voice itself.
#
# Usage:
#   laconic.sh on      [--project|--user] [prose-only|prose+code|laconic-code]
#   laconic.sh off     [--project|--user]
#   laconic.sh mode    <prose-only|prose+code|laconic-code> [--project|--user]
#   laconic.sh cadence <N> [--project|--user]   # remind every Nth turn (1 = every turn)
#   laconic.sh status
#   laconic.sh statusline   # compact badge for a status line ("◆ laconic-code" in code mode, "◆ laconic" otherwise, else nothing)
#   laconic.sh uninstall [--project|--user]   # unwire the hooks + delete this scope's state
#
# Defaults: scope = user; mode = prose+code; cadence = 1 (every turn).
# Precedence: a project state file overrides the user one (so a project `off`
# suppresses a user `on`). Cadence resolves the same way, from its own file.

set -euo pipefail

VALID_MODES="prose-only prose+code laconic-code"
DEFAULT_MODE="prose+code"
DEFAULT_CADENCE="1"   # reminder every turn; N means every Nth turn

user_state()    { echo "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/laconic.state"; }
project_state() { echo "${CLAUDE_PROJECT_DIR:-$PWD}/.claude/laconic.state"; }
user_cadence()    { echo "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/laconic.cadence"; }
project_cadence() { echo "${CLAUDE_PROJECT_DIR:-$PWD}/.claude/laconic.cadence"; }

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

write_cadence() {
  local file="$1" n="$2"
  mkdir -p "$(dirname "$file")"
  printf '%s\n' "$n" > "$file.tmp"
  mv "$file.tmp" "$file"
}

# Effective reminder cadence (a positive integer), project-over-user, else default.
resolve_cadence() {
  local proj user
  proj="$(read_state "$(project_cadence)")"
  if [ -n "$proj" ]; then echo "$proj"; return; fi
  user="$(read_state "$(user_cadence)")"
  if [ -n "$user" ]; then echo "$user"; return; fi
  echo "$DEFAULT_CADENCE"
}

cmd="${1:-status}"; shift || true

scope="user"
mode=""
num=""
for arg in "$@"; do
  case "$arg" in
    --project) scope="project" ;;
    --user)    scope="user" ;;
    prose-only|prose+code|laconic-code) mode="$arg" ;;
    ''|*[!0-9]*) echo "laconic: unexpected argument: $arg" >&2; exit 2 ;;
    *) num="$arg" ;;   # a run of digits: the cadence value
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
    [ -n "$mode" ] || { echo "laconic: mode requires prose-only|prose+code|laconic-code" >&2; exit 2; }
    file="$(target_file)"
    existing="$(read_state "$file")"; estate="${existing%% *}"
    [ "$estate" = "on" ] || estate="off"
    write_state "$file" "$estate" "$mode"
    echo "laconic mode=$mode ($scope, $estate) → $file"
    ;;
  cadence)
    # Turns between per-turn reminders. 1 = every turn (default). N = every Nth.
    [ -n "$num" ] || { echo "laconic: cadence requires a positive integer (turns between reminders)" >&2; exit 2; }
    [ "$num" -ge 1 ] 2>/dev/null || { echo "laconic: cadence must be >= 1" >&2; exit 2; }
    file="$(if [ "$scope" = "project" ]; then project_cadence; else user_cadence; fi)"
    write_cadence "$file" "$num"
    if [ "$num" -eq 1 ]; then
      echo "laconic cadence=1 (remind every turn) ($scope) → $file"
    else
      echo "laconic cadence=$num (remind every $num turns) ($scope) → $file"
    fi
    ;;
  status)
    read -r src state smode <<EOF
$(resolve)
EOF
    if [ "$src" = "none" ]; then
      echo "laconic: inactive (no state file). Default mode when enabled: $DEFAULT_MODE."
    else
      echo "laconic: $state (mode: $smode), resolved from $src scope"
      echo "  reminder cadence: every $(resolve_cadence) turn(s)"
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
    if [ "$state" = "on" ]; then
      [ "$smode" = "laconic-code" ] && printf '◆ laconic-code' || printf '◆ laconic'
    fi
    ;;
  uninstall)
    # Delegate to uninstall.sh (needs jq) for the same scope. It unwires the
    # SessionStart hook and deletes this scope's state file.
    script_dir="$(cd "$(dirname "$0")" && pwd)"
    if [ "$scope" = "project" ]; then
      exec "$script_dir/uninstall.sh" --project
    else
      exec "$script_dir/uninstall.sh" --user
    fi
    ;;
  -h|--help)
    sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
    ;;
  *)
    echo "laconic: unknown command: $cmd (use on|off|mode|status|uninstall)" >&2
    exit 2
    ;;
esac
