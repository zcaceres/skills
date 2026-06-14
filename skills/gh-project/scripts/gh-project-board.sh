#!/usr/bin/env bash
# gh-project-board.sh
#
# Shared helper for the gh-project Claude Code skill. Lives at
# .github/scripts/gh-project-board.sh in the user's repo (installed by
# /gh-project setup). The skill's subcommands call this script so board
# access is deterministic and avoids the truncation/context-bloat failure
# modes of raw `gh project item-list`.
#
# Reads .github/gh-project.json (written by /gh-project setup).
#
# Subcommands:
#   list [--query <q>] [--include-body]   Compact JSONL of all items.
#                                          Asserts fetched == totalCount;
#                                          exits non-zero on truncation.
#   find <selector>                       Resolve PVTI_… / issue# / title-substring.
#                                          Outputs zero or more JSONL rows.
#   get  <item-id>                        Full row for one item, body included.
#   set-status <item-id> <status-name>    Move card to a Status column.
#                                          Looks up field+option ids from config.
#   --help                                Usage.

set -euo pipefail

CONFIG_FILE=".github/gh-project.json"
ITEM_LIMIT=500

die() { printf 'gh-project-board: %s\n' "$*" >&2; exit 1; }

require_config() {
  [[ -f "$CONFIG_FILE" ]] || die "missing $CONFIG_FILE — run /gh-project setup"
}

cfg() { jq -r "$1" "$CONFIG_FILE"; }

cmd_list() {
  local query=""
  local include_body=0
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --query)        [[ $# -ge 2 ]] || die "--query needs a value"; query="$2"; shift 2 ;;
      --include-body) include_body=1; shift ;;
      -h|--help)      printf 'usage: list [--query <q>] [--include-body]\n'; return 0 ;;
      *)              die "list: unknown flag: $1" ;;
    esac
  done

  require_config
  local owner project_number
  owner=$(cfg .projectOwner)
  project_number=$(cfg .projectNumber)

  local args=( "$project_number" --owner "$owner" --format json --limit "$ITEM_LIMIT" )
  [[ -n "$query" ]] && args+=( --query "$query" )

  local raw
  raw=$(gh project item-list "${args[@]}") || die "gh project item-list failed"

  local fetched total
  fetched=$(printf '%s' "$raw" | jq '.items | length')
  total=$(printf '%s' "$raw"   | jq '.totalCount')

  if (( fetched < total )); then
    die "TRUNCATED: fetched $fetched of $total items (limit $ITEM_LIMIT). Narrow with --query or raise ITEM_LIMIT."
  fi

  local jq_filter
  if (( include_body )); then
    jq_filter='.items[] | {
      id,
      title,
      status,
      type:   (.content.type   // "Unknown"),
      number: (.content.number // null),
      url:    (.content.url    // null),
      body:   (.content.body   // .body // "")
    }'
  else
    jq_filter='.items[] | {
      id,
      title,
      status,
      type:        (.content.type   // "Unknown"),
      number:      (.content.number // null),
      url:         (.content.url    // null),
      bodyPreview: ((.content.body  // .body // "") | .[:120] | gsub("\n"; " "))
    }'
  fi

  printf '%s' "$raw" | jq -c "$jq_filter"
}

cmd_find() {
  [[ $# -ge 1 ]] || die "usage: find <PVTI_… | issue-number | title-substring>"
  local selector="$1"
  local rows
  rows=$(cmd_list)

  if [[ "$selector" =~ ^PVTI_ ]]; then
    printf '%s\n' "$rows" | jq -c --arg id "$selector" 'select(.id == $id)'
  elif [[ "$selector" =~ ^[0-9]+$ ]]; then
    printf '%s\n' "$rows" | jq -c --arg n "$selector" 'select(.number == ($n | tonumber))'
  else
    local needle
    needle=$(printf '%s' "$selector" | tr '[:upper:]' '[:lower:]')
    printf '%s\n' "$rows" | jq -c --arg q "$needle" 'select(.title | ascii_downcase | contains($q))'
  fi
}

cmd_get() {
  [[ $# -eq 1 ]] || die "usage: get <item-id>"
  local id="$1"
  cmd_list --include-body | jq -c --arg id "$id" 'select(.id == $id)'
}

cmd_set_status() {
  [[ $# -eq 2 ]] || die "usage: set-status <item-id> <status-name>"
  require_config
  local item_id="$1"
  local status_name="$2"
  local project_id status_field_id option_id
  project_id=$(cfg .projectId)
  status_field_id=$(cfg .statusField.id)
  option_id=$(jq -r --arg name "$status_name" '.statusField.options[$name] // empty' "$CONFIG_FILE")
  [[ -n "$option_id" ]] || die "unknown status '$status_name' — known: $(jq -r '.statusField.options | keys | join(", ")' "$CONFIG_FILE")"

  gh project item-edit \
    --id "$item_id" \
    --project-id "$project_id" \
    --field-id "$status_field_id" \
    --single-select-option-id "$option_id"
}

usage() {
  cat <<EOF
Usage:
  gh-project-board.sh list [--query <q>] [--include-body]
  gh-project-board.sh find <PVTI_… | issue-number | title-substring>
  gh-project-board.sh get  <item-id>
  gh-project-board.sh set-status <item-id> <status-name>

Reads .github/gh-project.json for project number, owner, status field id,
and status option ids. All output is compact JSONL on stdout; errors and
truncation warnings go to stderr with non-zero exit.
EOF
}

main() {
  [[ $# -gt 0 ]] || { usage >&2; exit 2; }
  local cmd="$1"; shift
  case "$cmd" in
    list)        cmd_list "$@" ;;
    find)        cmd_find "$@" ;;
    get)         cmd_get  "$@" ;;
    set-status)  cmd_set_status "$@" ;;
    -h|--help)   usage ;;
    *)           die "unknown subcommand: $cmd" ;;
  esac
}

main "$@"
