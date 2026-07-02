#!/usr/bin/env bash
# Cleanly reverse a laconic install: unwire the SessionStart hook from a Claude
# Code settings.json, restore any status line install.sh replaced with the
# laconic wrapper, and delete that scope's laconic.state. The exact inverse of
# install.sh. Idempotent. Re-running (or running when nothing is wired) is a
# no-op that still reports success.
#
# Usage:
#   scripts/uninstall.sh                   # user scope: $HOME/.claude/settings.json
#   scripts/uninstall.sh --project         # project scope: ./.claude/settings.json
#   scripts/uninstall.sh --target PATH     # explicit target file
#   scripts/uninstall.sh --keep-state      # unwire but keep laconic.state
#   scripts/uninstall.sh --statusline-only # restore the status line only; keep hook + state
#
# Requires: jq. macOS: brew install jq. Linux: apt-get install jq.
#
# What it does NOT touch: the skill's own files (managed by your skills CLI) and
# any laconic reference you hand-added to a `statusLine` command (as opposed to
# the managed wrapper). That one it can't safely rewrite, so it warns you to
# remove it yourself before the missing script breaks the status line.

set -euo pipefail

SKILL_NAME="laconic"
HOOK_EVENT="SessionStart"
# Match the wired hook by its tail, not an absolute path, so uninstall works
# regardless of the scope/CLAUDE_CONFIG_DIR the hook was installed under.
HOOK_NEEDLE="laconic/scripts/session-start.sh"

CLAUDE_HOME="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"

TARGET=""
KEEP_STATE=0
STATUSLINE_ONLY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --user)            TARGET="$CLAUDE_HOME/settings.json"; shift ;;
    --project)         TARGET="./.claude/settings.json"; shift ;;
    --target)          TARGET="$2"; shift 2 ;;
    --keep-state)      KEEP_STATE=1; shift ;;
    --statusline-only) STATUSLINE_ONLY=1; shift ;;
    -h|--help)
      sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "uninstall.sh: unknown flag: $1" >&2; exit 2 ;;
  esac
done
TARGET="${TARGET:-$CLAUDE_HOME/settings.json}"

# The state file and saved original status line live alongside settings.json in
# the same scope directory.
STATE_FILE="$(dirname "$TARGET")/laconic.state"
STATUSLINE_ORIG="$(dirname "$TARGET")/laconic.statusline.orig.json"

command -v jq >/dev/null || {
  echo "uninstall.sh: requires jq. Install:" >&2
  echo "  macOS:  brew install jq" >&2
  echo "  Linux:  apt-get install jq    (or: dnf install jq)" >&2
  exit 1
}

changed=0

# Back up once, lazily, before the first mutation. Shared across hook +
# status-line changes so a single run leaves at most one backup.
BACKUP=""
backup_once() {
  [ -n "$BACKUP" ] && return 0
  BACKUP="$TARGET.bak.$(date +%Y%m%d-%H%M%S)"
  cp "$TARGET" "$BACKUP"
  echo "  Backup: $BACKUP"
}

if [ -f "$TARGET" ]; then
  jq empty "$TARGET" 2>/dev/null || {
    echo "uninstall.sh: $TARGET is not valid JSON. Fix it before uninstalling." >&2
    exit 1
  }

  # --- Hook unwire (skipped with --statusline-only) --------------------------
  if [ "$STATUSLINE_ONLY" -eq 0 ]; then
    if jq -e --arg event "$HOOK_EVENT" --arg needle "$HOOK_NEEDLE" \
        '(.hooks[$event] // []) | map(.hooks[]?.command) | flatten
         | any(type == "string" and contains($needle))' \
        "$TARGET" > /dev/null 2>&1; then
      backup_once
      # Drop the laconic command from every SessionStart block, then prune
      # blocks, the event array, and the hooks object if they end up empty.
      jq --arg event "$HOOK_EVENT" --arg needle "$HOOK_NEEDLE" '
        if (.hooks[$event]?) then
          .hooks[$event] |= (
            map(.hooks |= map(select((.command // "" | contains($needle)) | not)))
            | map(select((.hooks | length) > 0))
          )
          | (if (.hooks[$event] | length) == 0 then del(.hooks[$event]) else . end)
          | (if (.hooks | length) == 0 then del(.hooks) else . end)
        else . end
      ' "$TARGET" > "$TARGET.tmp"
      mv "$TARGET.tmp" "$TARGET"
      echo "✓ Unwired $SKILL_NAME hook from $TARGET"
      changed=1
    else
      echo "• No $SKILL_NAME hook wired at $TARGET."
    fi
  fi

  # --- Status-line restore ---------------------------------------------------
  if jq -e '(.statusLine.command // "") | contains("statusline.sh")' "$TARGET" > /dev/null 2>&1; then
    backup_once
    saved="null"
    [ -f "$STATUSLINE_ORIG" ] && saved="$(jq -c '.' "$STATUSLINE_ORIG" 2>/dev/null || echo null)"
    if [ "$saved" = "null" ] || [ -z "$saved" ]; then
      # No saved original (or it was empty). Drop the wrapper so the soon-to-be
      # missing script can't break the status line.
      jq 'del(.statusLine)' "$TARGET" > "$TARGET.tmp"
      mv "$TARGET.tmp" "$TARGET"
      echo "✓ Removed $SKILL_NAME status-line wrapper at $TARGET."
    else
      jq --slurpfile s "$STATUSLINE_ORIG" '.statusLine = $s[0]' "$TARGET" > "$TARGET.tmp"
      mv "$TARGET.tmp" "$TARGET"
      echo "✓ Restored original status line at $TARGET"
    fi
    [ -f "$STATUSLINE_ORIG" ] && rm -f "$STATUSLINE_ORIG"
    changed=1
  elif jq -e '(.statusLine.command // "") | contains("laconic")' "$TARGET" > /dev/null 2>&1; then
    # A hand-added laconic reference (not the managed wrapper). Can't safely
    # rewrite it, so warn rather than break the line once the files are gone.
    echo
    echo "⚠ $TARGET has a hand-added 'laconic' reference in its statusLine command."
    echo "  Remove that part by hand. Once the skill's files are gone it will error."
  fi
else
  echo "• $TARGET does not exist; nothing to unwire."
fi

if [ "$STATUSLINE_ONLY" -eq 0 ] && [ "$KEEP_STATE" -eq 0 ] && [ -f "$STATE_FILE" ]; then
  rm -f "$STATE_FILE"
  echo "✓ Removed state file: $STATE_FILE"
  changed=1
fi

echo
if [ "$changed" -eq 1 ]; then
  echo "$SKILL_NAME uninstalled from this scope. Restart Claude Code (or open a new"
  echo "conversation) for the change to take effect."
else
  echo "Nothing to do. $SKILL_NAME was not wired in this scope."
fi
echo "The skill's files are left in place; remove them with your skills CLI if desired."
