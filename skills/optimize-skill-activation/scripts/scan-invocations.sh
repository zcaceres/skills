#!/usr/bin/env bash
# Scan recent Claude Code transcripts for Skill tool invocations and count
# slash vs auto invocation per skill name.
#
# Output: TSV — one line per skill, columns:
#   skill_name <TAB> slash_count <TAB> auto_count
#
# Usage:
#   scan-invocations.sh                  # current project
#   scan-invocations.sh --all            # all projects
#   scan-invocations.sh <transcript-dir> # explicit path
#
# Inline jq parsing is usually faster than this for the model; this script
# exists as a fallback when SKILL.md says "thin grep helper".

set -euo pipefail

if ! command -v jq >/dev/null 2>&1; then
  echo "scan-invocations.sh: requires jq (brew install jq)" >&2
  exit 1
fi

mode="current"
explicit_dir=""

case "${1:-}" in
  --all) mode="all" ;;
  "") ;;
  *) explicit_dir="$1" ;;
esac

transcript_root="${HOME}/.claude/projects"

if [[ -n "$explicit_dir" ]]; then
  search_dirs=("$explicit_dir")
elif [[ "$mode" == "all" ]]; then
  search_dirs=("$transcript_root")
else
  encoded="$(pwd | sed 's|/|-|g')"
  search_dirs=("${transcript_root}/${encoded}")
fi

# Collect up to 20 most recent JSONL transcripts across the chosen scope.
mapfile -t files < <(
  find "${search_dirs[@]}" -name '*.jsonl' -type f 2>/dev/null \
    | xargs -I{} stat -f '%m %N' {} 2>/dev/null \
    | sort -rn \
    | head -20 \
    | awk '{print $2}'
)

if [[ ${#files[@]} -eq 0 ]]; then
  echo "scan-invocations.sh: no transcripts found under ${search_dirs[*]}" >&2
  exit 0
fi

# For each transcript line that invokes the Skill tool, emit the skill name
# plus how it was triggered. We treat a user message of `/skill-name` on the
# turn immediately before the Skill tool call as a slash invocation; anything
# else is auto.
#
# This is a rough heuristic — refine inline if the model needs more accuracy.
for f in "${files[@]}"; do
  jq -r '
    select(.type == "assistant")
    | .message.content[]?
    | select(.type == "tool_use" and .name == "Skill")
    | .input.skill // empty
  ' "$f" 2>/dev/null \
    | awk '{print $0 "\tauto"}'

  jq -r '
    select(.type == "user")
    | .message.content
    | if type == "string" then . else (.[]? | .text // empty) end
    | capture("^/(?<n>[a-z0-9][a-z0-9-]*)") // empty
    | .n
  ' "$f" 2>/dev/null \
    | awk '{print $0 "\tslash"}'
done | awk -F'\t' '
  { counts[$1 "\t" $2]++ }
  END {
    for (k in counts) print k "\t" counts[k]
  }
' | awk -F'\t' '
  {
    skills[$1]
    if ($2 == "slash") slash[$1] += $3
    else               auto[$1]  += $3
  }
  END {
    for (s in skills) {
      printf "%s\t%d\t%d\n", s, (slash[s]+0), (auto[s]+0)
    }
  }
' | sort
