#!/usr/bin/env bash
# Wire the pr diff-size nudge hook into a host's hook config so it fires
# after every file-modifying tool call, not just when this skill is loaded
# into context. Supports Claude Code (PostToolUse hook; Edit|Write|MultiEdit|
# NotebookEdit), Codex (PostToolUse hook; apply_patch), and Gemini CLI
# (AfterTool hook; replace|write_file) from the same skill dir. The event,
# matcher, and config path are selected by --agent. Idempotent.
#
# Usage:
#   scripts/install.sh                  # auto-detect host, user scope
#   scripts/install.sh --agent gemini   # wire for Gemini CLI  (~/.gemini)
#   scripts/install.sh --agent codex    # wire for Codex       (~/.codex)
#   scripts/install.sh --agent claude   # wire for Claude Code (~/.claude)
#   scripts/install.sh --project        # project scope under the host config dir
#   scripts/install.sh --target PATH    # explicit target file
#
# Requires: jq. macOS: brew install jq. Linux: apt-get install jq.
#
# Why this exists: skills.sh CLI is a pure file copier — no install
# lifecycle. SKILL.md frontmatter hooks only fire while the skill is
# active in context, so the nudge would only fire when this skill is
# loaded. Wiring into the host config gets the nudge on every edit.

set -euo pipefail

SKILL_NAME="pr"

# Resolve the runner from this script's own location so it points at the
# correct binary launcher whether the skill was installed at user or project
# scope. The binary distinguishes host payloads; install.sh only wires the
# host-specific event, matcher, and config path.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOK_COMMAND="$SCRIPT_DIR/run.sh"

AGENT=""
SCOPE=""
TARGET=""
while [ $# -gt 0 ]; do
  case "$1" in
    --agent)   AGENT="$2"; shift 2 ;;
    --user)    SCOPE="user"; shift ;;
    --project) SCOPE="project"; shift ;;
    --target)  TARGET="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,21p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "install.sh: unknown flag: $1" >&2; exit 2 ;;
  esac
done

# Preserve the historical Gemini precedence when Claude is absent. Detect Codex
# only when it is the sole existing host config dir; Claude wins when present.
if [ -z "$AGENT" ]; then
  if [ -d "$HOME/.gemini" ] && [ ! -d "$HOME/.claude" ]; then
    AGENT="gemini"
  elif [ -d "$HOME/.codex" ] && [ ! -d "$HOME/.claude" ] && [ ! -d "$HOME/.gemini" ]; then
    AGENT="codex"
  else
    AGENT="claude"
  fi
fi

case "$AGENT" in
  claude)
    HOOK_EVENT="PostToolUse"
    HOOK_MATCHER="Edit|Write|MultiEdit|NotebookEdit"
    HOME_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
    PROJECT_SUBDIR=".claude"
    CONFIG_FILE="settings.json"
    HOST_LABEL="Claude Code"
    ;;
  codex)
    HOOK_EVENT="PostToolUse"
    HOOK_MATCHER="apply_patch"
    HOME_DIR="${CODEX_HOME:-$HOME/.codex}"
    PROJECT_SUBDIR=".codex"
    CONFIG_FILE="hooks.json"
    HOST_LABEL="Codex"
    ;;
  gemini)
    HOOK_EVENT="AfterTool"
    HOOK_MATCHER="replace|write_file"
    HOME_DIR="${GEMINI_CONFIG_DIR:-$HOME/.gemini}"
    PROJECT_SUBDIR=".gemini"
    CONFIG_FILE="settings.json"
    HOST_LABEL="Gemini CLI"
    ;;
  *) echo "install.sh: unknown --agent '$AGENT' (expected: claude|codex|gemini)" >&2; exit 2 ;;
esac

case "$SCOPE" in
  user)    TARGET="$HOME_DIR/$CONFIG_FILE" ;;
  project) TARGET="./$PROJECT_SUBDIR/$CONFIG_FILE" ;;
esac
TARGET="${TARGET:-$HOME_DIR/$CONFIG_FILE}"

[ -x "$HOOK_COMMAND" ] || {
  echo "install.sh: runner not found at $HOOK_COMMAND" >&2
  echo "Run install.sh from inside the unpacked skill's scripts/ directory." >&2
  exit 1
}

# Provision the platform binary the hook execs (download from this skill's
# GitHub release, or build with bun). Independent of the settings wiring below
# and best-effort: a missing binary only makes the hook a silent no-op, so we
# never abort the install over it. Runs on every invocation, so re-running
# install.sh also repairs a wired-but-missing-binary state.
if [ -x "$SCRIPT_DIR/fetch-binary.sh" ]; then
  "$SCRIPT_DIR/fetch-binary.sh" || \
    echo "⚠ $SKILL_NAME: binary not provisioned — run $SCRIPT_DIR/fetch-binary.sh once gh or bun is available." >&2
fi

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

# Warn — but don't block — when an older standalone pr-size-nudge hook
# is also wired. The two hooks namespaced separately so both can coexist,
# but the user will get double nudges until they remove the old entry.
if jq -e --arg event "$HOOK_EVENT" \
    '(.hooks[$event] // []) | map(.hooks[]?.command) | flatten
     | any(test("/pr-size-nudge/scripts/run\\.(sh|cmd)$"))' \
    "$TARGET" > /dev/null 2>&1; then
  echo "⚠ Detected an older pr-size-nudge hook entry in $TARGET."
  echo "  Both hooks will fire and you'll get double nudges until you"
  echo "  remove the old entry. See the deprecation banner in"
  echo "  pr-size-nudge/SKILL.md for migration."
  echo
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
if [ "$AGENT" = "codex" ]; then
  echo "Review and trust the new command hook with /hooks in Codex."
  echo
fi
echo "Restart $HOST_LABEL (or open a new conversation) for the hook to take effect."
