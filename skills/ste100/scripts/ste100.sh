#!/usr/bin/env bash
# ste100: control surface for the ASD-STE100 Simplified Technical English rules.
#
# Reads/writes a tiny state file ("on" or "off") at project or user scope.
# The SessionStart hook (session-start.sh) reads that state and injects the
# rules when active; this script never prints the rules itself.
#
# Usage:
#   ste100.sh on      [--project|--user]
#   ste100.sh off     [--project|--user]
#   ste100.sh cadence <N> [--project|--user]   # remind every Nth turn (1 = every turn)
#   ste100.sh status
#   ste100.sh statusline   # compact badge for a status line ("◆ ste100", else nothing)
#   ste100.sh uninstall [--project|--user]   # unwire the hooks + delete this scope's state
#
# Defaults: scope = user; cadence = 1 (every turn).
# Precedence: a project state file overrides the user one (so a project `off`
# suppresses a user `on`). Cadence resolves the same way, from its own file.

set -euo pipefail

DEFAULT_CADENCE="1"   # reminder every turn; N means every Nth turn

user_state()    { echo "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/ste100.state"; }
project_state() { echo "${CLAUDE_PROJECT_DIR:-$PWD}/.claude/ste100.state"; }
user_cadence()    { echo "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/ste100.cadence"; }
project_cadence() { echo "${CLAUDE_PROJECT_DIR:-$PWD}/.claude/ste100.cadence"; }

# First line of a state file ("on" or "off"), or empty if absent.
read_state() { [ -f "$1" ] && head -n1 "$1" | tr -d '\r\n' || true; }

write_state() {
  local file="$1" state="$2"
  mkdir -p "$(dirname "$file")"
  printf '%s\n' "$state" > "$file.tmp"
  mv "$file.tmp" "$file"
}

# Effective "<src> <state>", honouring project-over-user precedence.
resolve() {
  local proj user
  proj="$(read_state "$(project_state)")"
  if [ -n "$proj" ]; then echo "project $proj"; return; fi
  user="$(read_state "$(user_state)")"
  if [ -n "$user" ]; then echo "user $user"; return; fi
  echo "none off"
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
num=""
for arg in "$@"; do
  case "$arg" in
    --project) scope="project" ;;
    --user)    scope="user" ;;
    ''|*[!0-9]*) echo "ste100: unexpected argument: $arg" >&2; exit 2 ;;
    *) num="$arg" ;;   # a run of digits: the cadence value
  esac
done

target_file() { if [ "$scope" = "project" ]; then project_state; else user_state; fi; }

case "$cmd" in
  on)
    file="$(target_file)"
    write_state "$file" on
    echo "ste100 on ($scope) → $file"
    ;;
  off)
    # Write an explicit `off` (rather than deleting) so a project-scope off can
    # override a user-scope on.
    file="$(target_file)"
    write_state "$file" off
    echo "ste100 off ($scope) → $file"
    ;;
  cadence)
    # Turns between per-turn reminders. 1 = every turn (default). N = every Nth.
    [ -n "$num" ] || { echo "ste100: cadence requires a positive integer (turns between reminders)" >&2; exit 2; }
    [ "$num" -ge 1 ] 2>/dev/null || { echo "ste100: cadence must be >= 1" >&2; exit 2; }
    file="$(if [ "$scope" = "project" ]; then project_cadence; else user_cadence; fi)"
    write_cadence "$file" "$num"
    if [ "$num" -eq 1 ]; then
      echo "ste100 cadence=1 (remind every turn) ($scope) → $file"
    else
      echo "ste100 cadence=$num (remind every $num turns) ($scope) → $file"
    fi
    ;;
  status)
    read -r src state <<EOF
$(resolve)
EOF
    if [ "$src" = "none" ]; then
      echo "ste100: inactive (no state file)."
    else
      echo "ste100: $state, resolved from $src scope"
      echo "  reminder cadence: every $(resolve_cadence) turn(s)"
      echo "  project: '$(read_state "$(project_state)")'  [$(project_state)]"
      echo "  user:    '$(read_state "$(user_state)")'  [$(user_state)]"
    fi
    ;;
  statusline)
    # Compact badge for embedding in a status line. Prints nothing (and no
    # trailing newline) when ste100 is off/unset, so callers can splice it in
    # unconditionally. Honours project-over-user precedence via resolve().
    read -r src state <<EOF
$(resolve)
EOF
    [ "$state" = "on" ] && printf '◆ ste100' || true
    ;;
  uninstall)
    # Delegate to uninstall.sh (needs jq) for the same scope. It unwires both
    # hooks and deletes this scope's state file.
    script_dir="$(cd "$(dirname "$0")" && pwd)"
    if [ "$scope" = "project" ]; then
      exec "$script_dir/uninstall.sh" --project
    else
      exec "$script_dir/uninstall.sh" --user
    fi
    ;;
  -h|--help)
    sed -n '2,19p' "$0" | sed 's/^# \{0,1\}//'
    ;;
  *)
    echo "ste100: unknown command: $cmd (use on|off|cadence|status|statusline|uninstall)" >&2
    exit 2
    ;;
esac
