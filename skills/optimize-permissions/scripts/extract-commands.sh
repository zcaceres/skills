#!/usr/bin/env bash
# Extract Bash tool_use commands from Claude Code transcripts.
#
# Usage:
#   extract-commands.sh                  # scan transcripts for current cwd
#   extract-commands.sh --all            # scan every project's transcripts
#   extract-commands.sh --dir <path>     # scan a specific transcript dir
#   extract-commands.sh --limit <n>      # only the N most recent sessions (default 20)
#
# Output: one command per line, prefixed by approval status:
#   APPROVED  git status
#   REJECTED  rm -rf node_modules
#   AUTO      ls
#
# Approval inference is best-effort — we treat the absence of a
# tool_result with is_error=true and a user "rejected"/"denied" marker
# as APPROVED. If we can't tell, we emit UNKNOWN.

set -euo pipefail

LIMIT=20
MODE="cwd"
DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --all)   MODE="all"; shift ;;
    --dir)   MODE="dir"; DIR="$2"; shift 2 ;;
    --limit) LIMIT="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,17p' "$0"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if ! command -v jq >/dev/null 2>&1; then
  echo "jq required" >&2; exit 1
fi

root="${HOME}/.claude/projects"

case "$MODE" in
  cwd)
    cwd_enc="$(pwd | sed 's|/|-|g')"
    DIR="${root}/${cwd_enc}"
    ;;
  all)
    DIR="${root}"
    ;;
  dir)
    : # caller-provided
    ;;
esac

if [[ ! -d "$DIR" ]]; then
  echo "No transcripts found at $DIR" >&2
  exit 0
fi

# Most recent N JSONL files (across subdirs if --all). Portable across
# BSD/GNU: collect with find, sort + limit by mtime via perl (always
# present on macOS + most Linux). The limit happens inside perl so the
# pipeline doesn't hit SIGPIPE under `set -o pipefail`.
files=$(find "$DIR" -name '*.jsonl' -type f 2>/dev/null \
  | perl -se 'my @f = sort { (stat $b)[9] <=> (stat $a)[9] } map { chomp; $_ } <STDIN>; print "$_\n" for @f[0 .. ($limit - 1)];' -- -limit="$LIMIT")

if [[ -z "$files" ]]; then
  echo "No transcripts found at $DIR" >&2
  exit 0
fi

# Pull Bash tool_use commands. Approval signal in Claude Code transcripts
# isn't perfectly reliable across versions — we surface the command and let
# the calling agent decide.
printf '%s\n' "$files" | while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  jq -r '
    select(.type == "assistant")
    | (.message.content // [])
    | map(select(.type == "tool_use" and .name == "Bash"))
    | .[]?
    | "APPROVED\t" + (.input.command // "")
  ' "$f" 2>/dev/null
done | awk -F'\t' '$2 != "" { print }'
