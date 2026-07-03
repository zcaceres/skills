#!/usr/bin/env bash
# Wire the laconic SessionStart hook into a Claude Code settings.json so the
# voice is injected at the start of every session (and after context
# compaction), not just when the skill is loaded in context. Also wires the
# status-line badge by default (see --no-statusline). Idempotent. Re-running is
# a no-op.
#
# Usage:
#   scripts/install.sh                 # user scope: $HOME/.claude/settings.json
#   scripts/install.sh --project       # project scope: ./.claude/settings.json
#   scripts/install.sh --target PATH   # explicit target file
#   scripts/install.sh --no-statusline # wire the hook only; skip the badge
#
# The status-line badge is added by default: install.sh saves any existing
# `.statusLine` and replaces it with the laconic wrapper (statusline.sh), which
# runs your original status line and appends "◆ laconic" when the voice is on.
# uninstall.sh restores the saved original. Remove just the badge (keeping the
# voice) with: uninstall.sh --statusline-only.
#
# Requires: jq. macOS: brew install jq. Linux: apt-get install jq.
#
# Why this exists: the skills.sh CLI is a pure file copier. No install
# lifecycle. SKILL.md frontmatter hooks only fire while the skill is active in
# context, so they're not always-on. Wiring into settings.json is the only way
# to keep the voice on across sessions. Toggle it with `/laconic on|off`.

set -euo pipefail

SKILL_NAME="laconic"
# Two hooks: SessionStart injects the full voice; UserPromptSubmit restates it
# each turn to counter mid-session drift. UserPromptSubmit takes no matcher.
SESSION_EVENT="SessionStart"
SESSION_MATCHER="startup|resume|clear|compact"
REMINDER_EVENT="UserPromptSubmit"
REMINDER_MATCHER=""

CLAUDE_HOME="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
# Resolve hook commands from this script's own location so they point at the
# correct hooks whether the skill was installed at user scope, project scope,
# or under a custom CLAUDE_CONFIG_DIR.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SESSION_COMMAND="$SCRIPT_DIR/session-start.sh"
REMINDER_COMMAND="$SCRIPT_DIR/prompt-reminder.sh"
STATUSLINE_WRAPPER="$SCRIPT_DIR/statusline.sh"

TARGET=""
WIRE_STATUSLINE=1
while [ $# -gt 0 ]; do
  case "$1" in
    --user)          TARGET="$CLAUDE_HOME/settings.json"; shift ;;
    --project)       TARGET="./.claude/settings.json"; shift ;;
    --target)        TARGET="$2"; shift 2 ;;
    --no-statusline) WIRE_STATUSLINE=0; shift ;;
    -h|--help)
      sed -n '2,25p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "install.sh: unknown flag: $1" >&2; exit 2 ;;
  esac
done
TARGET="${TARGET:-$CLAUDE_HOME/settings.json}"

for cmd in "$SESSION_COMMAND" "$REMINDER_COMMAND"; do
  [ -x "$cmd" ] || {
    echo "install.sh: hook not found or not executable at $cmd" >&2
    echo "Run install.sh from inside the unpacked skill's scripts/ directory." >&2
    exit 1
  }
done

command -v jq >/dev/null || {
  echo "install.sh: requires jq. Install:" >&2
  echo "  macOS:  brew install jq" >&2
  echo "  Linux:  apt-get install jq    (or: dnf install jq)" >&2
  exit 1
}

mkdir -p "$(dirname "$TARGET")"
[ -f "$TARGET" ] || echo '{}' > "$TARGET"

jq empty "$TARGET" 2>/dev/null || {
  echo "install.sh: $TARGET is not valid JSON. Fix it before installing." >&2
  exit 1
}

# Back up once, lazily, before the first mutation. Shared by hook + statusline
# wiring so a single run leaves at most one backup.
BACKUP=""
backup_once() {
  [ -n "$BACKUP" ] && return 0
  BACKUP="$TARGET.bak.$(date +%Y%m%d-%H%M%S)"
  cp "$TARGET" "$BACKUP"
  echo "  Backup: $BACKUP"
}

# --- Hook wiring ------------------------------------------------------------
# Wire one command under one event, idempotently. A blank matcher wires the
# block with no matcher key (the form UserPromptSubmit expects).
wire_hook() {
  local event="$1" matcher="$2" cmd="$3"
  if jq -e --arg event "$event" --arg cmd "$cmd" \
      '(.hooks[$event] // []) | map(.hooks[]?.command) | flatten | any(. == $cmd)' \
      "$TARGET" > /dev/null 2>&1; then
    echo "✓ $SKILL_NAME $event hook already wired at $TARGET."
    return 0
  fi
  backup_once
  if [ -n "$matcher" ]; then
    jq --arg event "$event" --arg matcher "$matcher" --arg cmd "$cmd" \
       '.hooks //= {} | .hooks[$event] //= [] |
        .hooks[$event] += [{matcher: $matcher, hooks: [{type: "command", command: $cmd}]}]' \
       "$TARGET" > "$TARGET.tmp"
  else
    jq --arg event "$event" --arg cmd "$cmd" \
       '.hooks //= {} | .hooks[$event] //= [] |
        .hooks[$event] += [{hooks: [{type: "command", command: $cmd}]}]' \
       "$TARGET" > "$TARGET.tmp"
  fi
  mv "$TARGET.tmp" "$TARGET"
  echo "✓ Wired $SKILL_NAME $event hook → $TARGET"
}

wire_hook "$SESSION_EVENT"  "$SESSION_MATCHER"  "$SESSION_COMMAND"
wire_hook "$REMINDER_EVENT" "$REMINDER_MATCHER" "$REMINDER_COMMAND"

# --- Status-line badge wiring ----------------------------------------------
if [ "$WIRE_STATUSLINE" -eq 1 ]; then
  [ -x "$STATUSLINE_WRAPPER" ] || {
    echo "install.sh: status-line wrapper not found or not executable at $STATUSLINE_WRAPPER" >&2
    exit 1
  }
  if jq -e '(.statusLine.command // "") | contains("statusline.sh")' "$TARGET" > /dev/null 2>&1; then
    echo "✓ $SKILL_NAME status-line badge already wired at $TARGET."
  elif jq -e '(.statusLine.command // "") | contains("laconic")' "$TARGET" > /dev/null 2>&1; then
    # A hand-added laconic reference exists but isn't our wrapper. Wrapping it
    # would double the badge, so leave it and let the user decide.
    echo "⚠ $TARGET already has a hand-added 'laconic' reference in its statusLine."
    echo "  Skipping badge wiring to avoid a double badge. Remove that reference by"
    echo "  hand, then re-run to wire the managed wrapper."
  else
    STATUSLINE_ORIG="$(dirname "$TARGET")/laconic.statusline.orig.json"
    NEW_CMD="LACONIC_STATUSLINE_ORIG='$STATUSLINE_ORIG' '$STATUSLINE_WRAPPER'"
    backup_once
    # Save the existing .statusLine (object or null) so uninstall can restore it.
    jq '.statusLine // null' "$TARGET" > "$STATUSLINE_ORIG"
    jq --arg cmd "$NEW_CMD" '.statusLine = {type: "command", command: $cmd}' \
      "$TARGET" > "$TARGET.tmp"
    mv "$TARGET.tmp" "$TARGET"
    echo "✓ Wired $SKILL_NAME status-line badge → $TARGET"
    echo "  Saved original status line: $STATUSLINE_ORIG"
  fi
fi

echo
echo "Now enable it: /laconic on   (or run scripts/laconic.sh on)."
echo "Restart Claude Code (or open a new conversation) for the changes to take effect."
