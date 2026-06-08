#!/usr/bin/env bash
# Wire the pr-size-nudge PostToolUse hook (matchers: Edit, Write, MultiEdit,
# NotebookEdit) into a Claude Code settings.json so it nudges toward
# /checkpoint after every file-modifying tool call. Idempotent — re-running
# is a no-op.
#
# Usage:
#   scripts/install.sh                 # user scope: $HOME/.claude/settings.json
#   scripts/install.sh --project       # project scope: ./.claude/settings.json
#   scripts/install.sh --target PATH   # explicit target file
#
# Requires: jq. macOS: brew install jq. Linux: apt-get install jq.
#
# Why this exists: skills.sh CLI is a pure file copier — no install
# lifecycle. SKILL.md frontmatter hooks only fire while the skill is
# active in context, so the nudge would only fire when this skill is
# loaded. Wiring into settings.json gets the nudge on every edit.

set -euo pipefail

SKILL_NAME="pr-size-nudge"
HOOK_EVENT="PostToolUse"
HOOK_MATCHER="Edit|Write|MultiEdit|NotebookEdit"

CLAUDE_HOME="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
HOOK_COMMAND="$CLAUDE_HOME/skills/$SKILL_NAME/scripts/run.sh"

TARGET=""
while [ $# -gt 0 ]; do
  case "$1" in
    --user)    TARGET="$CLAUDE_HOME/settings.json"; shift ;;
    --project) TARGET="./.claude/settings.json"; shift ;;
    --target)  TARGET="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//'
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

mkdir -p "$(dirname "$TARGET")"
[ -f "$TARGET" ] || echo '{}' > "$TARGET"

jq empty "$TARGET" 2>/dev/null || {
  echo "install.sh: $TARGET is not valid JSON. Fix it before installing." >&2
  exit 1
}

if jq -e --arg event "$HOOK_EVENT" --arg cmd "$HOOK_COMMAND" \
    '(.hooks[$event] // []) | map(.hooks[]?.command) | flatten | any(. == $cmd)' \
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
