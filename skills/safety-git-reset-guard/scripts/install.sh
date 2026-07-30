#!/usr/bin/env bash
# Wire the safety-git-reset-guard PreToolUse:Bash hook into Claude Code or
# Codex so it fires on every Bash call, not just when the skill is loaded
# into context. Idempotent — re-running is a no-op.
#
# Usage:
#   scripts/install.sh                 # user scope: $HOME/.claude/settings.json
#   scripts/install.sh --project       # project scope: ./.claude/settings.json
#   scripts/install.sh --target PATH   # explicit target file
#   scripts/install.sh --codex         # user scope: $CODEX_HOME/hooks.json
#   scripts/install.sh --codex --project # project scope: ./.codex/hooks.json
#
# Requires: jq. macOS: brew install jq. Linux: apt-get install jq.
#
# Why this exists: skills.sh CLI is a pure file copier — no install
# lifecycle. SKILL.md frontmatter hooks only fire while the skill is
# active in context, so they're not a real always-on guard. Wiring
# into settings.json is the only way to get always-on protection.

set -euo pipefail

SKILL_NAME="safety-git-reset-guard"
HOOK_EVENT="PreToolUse"
HOOK_MATCHER="Bash"

CLAUDE_HOME="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
# Resolve HOOK_COMMAND from this script's own location so it points at the
# correct runner whether the skill was installed at user scope, project
# scope, or under a custom CLAUDE_CONFIG_DIR.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOK_COMMAND="$SCRIPT_DIR/run.sh"

TARGET=""
AGENT="claude"
SCOPE="user"
while [ $# -gt 0 ]; do
  case "$1" in
    --claude)  AGENT="claude"; shift ;;
    --codex)   AGENT="codex"; shift ;;
    --user)    SCOPE="user"; shift ;;
    --project) SCOPE="project"; shift ;;
    --target)  TARGET="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "install.sh: unknown flag: $1" >&2; exit 2 ;;
  esac
done
if [ -z "$TARGET" ]; then
  if [ "$AGENT" = "codex" ]; then
    [ "$SCOPE" = "project" ] && TARGET="./.codex/hooks.json" || TARGET="$CODEX_HOME/hooks.json"
  else
    [ "$SCOPE" = "project" ] && TARGET="./.claude/settings.json" || TARGET="$CLAUDE_HOME/settings.json"
  fi
fi

[ -x "$HOOK_COMMAND" ] || {
  echo "install.sh: runner not found at $HOOK_COMMAND" >&2
  echo "Run install.sh from inside the unpacked skill's scripts/ directory." >&2
  exit 1
}

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

BACKUP="$TARGET.bak.$(date +%Y%m%d-%H%M%S).$$"
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
if [ "$AGENT" = "codex" ]; then
  echo "Open /hooks in Codex and review and trust the new hook."
else
  echo "Restart Claude Code (or open a new conversation) for the hook to take effect."
fi
