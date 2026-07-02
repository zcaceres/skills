#!/usr/bin/env bash
# Wire the security-scfw PreToolUse hook (matcher: Bash) into a Claude Code
# settings.json so it fires on every Bash tool call, not just when the skill is
# loaded into context. Idempotent — re-running is a no-op.
#
# Usage:
#   scripts/install.sh                 # user scope: $HOME/.claude/settings.json
#   scripts/install.sh --project       # project scope: ./.claude/settings.json
#   scripts/install.sh --target PATH   # explicit target file
#   scripts/install.sh --remove        # remove the hook (add --project/--target to scope)
#
# Requires: jq. macOS: brew install jq. Linux: apt-get install jq.
#
# Why this exists: skills.sh CLI is a pure file copier — no install lifecycle.
# SKILL.md frontmatter hooks only fire while the skill is active in context, so
# they're not a real always-on guard. Wiring into settings.json is the only way
# to get always-on protection for the agent's own pip/npm/poetry installs.

set -euo pipefail

SKILL_NAME="security-scfw"
HOOK_EVENT="PreToolUse"
HOOK_MATCHER="Bash"

CLAUDE_HOME="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
# Resolve HOOK_COMMAND from this script's own location so it points at the
# correct guard whether the skill was installed at user scope, project scope,
# or under a custom CLAUDE_CONFIG_DIR.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOK_COMMAND="$SCRIPT_DIR/scfw-guard.sh"

TARGET=""
REMOVE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --user)    TARGET="$CLAUDE_HOME/settings.json"; shift ;;
    --project) TARGET="./.claude/settings.json"; shift ;;
    --target)  TARGET="$2"; shift 2 ;;
    --remove)  REMOVE=1; shift ;;
    -h|--help)
      sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "install.sh: unknown flag: $1" >&2; exit 2 ;;
  esac
done
TARGET="${TARGET:-$CLAUDE_HOME/settings.json}"

command -v jq >/dev/null || {
  echo "install.sh: requires jq. Install:" >&2
  echo "  macOS:  brew install jq" >&2
  echo "  Linux:  apt-get install jq    (or: dnf install jq)" >&2
  exit 1
}

if [ "$REMOVE" -eq 1 ]; then
  [ -f "$TARGET" ] || { echo "✓ Nothing to remove: $TARGET does not exist."; exit 0; }
  jq empty "$TARGET" 2>/dev/null || {
    echo "install.sh: $TARGET is not valid JSON. Fix it before removing." >&2
    exit 1
  }
  if ! jq -e --arg event "$HOOK_EVENT" --arg cmd "$HOOK_COMMAND" \
      '(.hooks[$event] // []) | map(.hooks[]?.command) | any(. == $cmd)' \
      "$TARGET" > /dev/null 2>&1; then
    echo "✓ $SKILL_NAME hook not present at $TARGET. No changes."
    exit 0
  fi
  BACKUP="$TARGET.bak.$(date +%Y%m%d-%H%M%S)"
  cp "$TARGET" "$BACKUP"
  # Drop any PreToolUse group that references our guard command.
  jq --arg event "$HOOK_EVENT" --arg cmd "$HOOK_COMMAND" \
     'if .hooks[$event] then
        .hooks[$event] |= map(select(((.hooks // []) | map(.command) | index($cmd)) | not))
      else . end' \
     "$TARGET" > "$TARGET.tmp"
  mv "$TARGET.tmp" "$TARGET"
  echo "✓ Removed $SKILL_NAME hook → $TARGET"
  echo "  Backup: $BACKUP"
  echo
  echo "Restart Claude Code (or open a new conversation) for the change to take effect."
  exit 0
fi

[ -x "$HOOK_COMMAND" ] || {
  echo "install.sh: guard not found or not executable at $HOOK_COMMAND" >&2
  echo "Run install.sh from inside the unpacked skill's scripts/ directory." >&2
  exit 1
}

mkdir -p "$(dirname "$TARGET")"
[ -f "$TARGET" ] || echo '{}' > "$TARGET"

jq empty "$TARGET" 2>/dev/null || {
  echo "install.sh: $TARGET is not valid JSON. Fix it before installing." >&2
  exit 1
}

if jq -e --arg event "$HOOK_EVENT" --arg cmd "$HOOK_COMMAND" \
    '(.hooks[$event] // []) | map(.hooks[]?.command) | any(. == $cmd)' \
    "$TARGET" > /dev/null 2>&1; then
  echo "✓ $SKILL_NAME hook already wired at $TARGET. No changes."
  exit 0
fi

BACKUP="$TARGET.bak.$(date +%Y%m%d-%H%M%S)"
cp "$TARGET" "$BACKUP"

jq --arg event "$HOOK_EVENT" \
   --arg matcher "$HOOK_MATCHER" \
   --arg cmd "$HOOK_COMMAND" \
   '.hooks //= {} |
    .hooks[$event] //= [] |
    .hooks[$event] += [{matcher: $matcher, hooks: [{type: "command", command: $cmd}]}]' \
   "$TARGET" > "$TARGET.tmp"
mv "$TARGET.tmp" "$TARGET"

echo "✓ Wired $SKILL_NAME → $TARGET"
echo "  Backup: $BACKUP"
echo
echo "Restart Claude Code (or open a new conversation) for the hook to take effect."
echo "Remove later with: $SCRIPT_DIR/install.sh --remove"
