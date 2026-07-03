#!/usr/bin/env bash
# Dump an AI agent's file-based memories into one stream, so the calling agent
# can read the whole corpus and synthesize insights in a single tool call.
# Defaults to the current project's memory store; --all spans every project.
#
# Unlike audit-memories' scan (frontmatter-only inventory), this prints full
# bodies — the point here is synthesis, not triage. Each memory becomes a
# labeled block: project, type, name, description, then the body verbatim.
# MEMORY.md indexes are skipped (their content is redundant with the per-file
# descriptions and would just inflate the stream).
#
# Usage:
#   gather-memories.sh                 # current project's memory store (default)
#   gather-memories.sh --all           # every Claude per-project memory store + global
#   gather-memories.sh --dir <path>    # a specific memory dir (repeatable)
#   gather-memories.sh --min-age <d>   # only memories at least <d> days old
#
# "Current project" is resolved from the git main-worktree root (falling back to
# $PWD), matching how Claude Code names its per-project memory dir. If auto-detect
# misses, pass the dir explicitly with --dir.
#
# A leading summary line reports project/file/type counts so the caller can
# gauge corpus size before reading on.

set -euo pipefail

DIRS=()
MODE="current"
MIN_AGE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --all) MODE="all"; shift ;;
    --dir) MODE="explicit"; DIRS+=("$2"); shift 2 ;;
    --min-age) MIN_AGE="$2"; shift 2 ;;
    -h|--help) sed -n '2,23p' "$0"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

now="$(date +%s)"

# Portable mtime-as-epoch (BSD/GNU `stat` flags differ; perl is always present).
mtime_epoch() { perl -e 'print((stat $ARGV[0])[9] // 0)' "$1" 2>/dev/null || echo 0; }

# Encode an absolute path the way Claude Code names its project dirs: every
# '/' and '.' becomes '-'.
encode_path() { printf '%s' "$1" | sed 's#[/.]#-#g'; }

# The memory dir for the current project. Claude Code keys memory to the git
# main-worktree root (a linked worktree under .claude/worktrees/ maps back to
# it), so resolve that first; fall back to $PWD for non-git dirs.
current_memory_dir() {
  local root="${HOME}/.claude/projects" base cand

  base="$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
  if [[ -n "$base" ]]; then
    cand="${root}/$(encode_path "$(dirname "$base")")/memory"
    [[ -d "$cand" ]] && { printf '%s\n' "$cand"; return 0; }
  fi

  cand="${root}/$(encode_path "$PWD")/memory"
  [[ -d "$cand" ]] && { printf '%s\n' "$cand"; return 0; }
  return 1
}

discover() {
  local root="${HOME}/.claude/projects"
  case "$MODE" in
    explicit) printf '%s\n' "${DIRS[@]}" ;;
    current) current_memory_dir || true ;;
    all)
      find "$root" -maxdepth 2 -type d -name memory 2>/dev/null
      printf '%s\n' "${HOME}/.claude/memory"
      ;;
  esac
}

# Label a memory dir with its project slug (the path segment before /memory).
project_of() {
  local dir="$1"
  case "$dir" in
    "${HOME}/.claude/memory") echo "(global)" ;;
    *) basename "$(dirname "$dir")" | sed 's|^-Users-[^-]*-||' ;;
  esac
}

# Pull one frontmatter field (first match) from the top of a file.
fm() {
  awk -v key="$2" '
    NR==1 && $0!="---" { exit }
    NR>1 && $0=="---"  { exit }
    { line=$0; sub(/^[[:space:]]+/, "", line)
      if (line ~ "^" key ":") {
        sub("^" key ":[[:space:]]*", "", line)
        gsub(/^["'\''[:space:]]+|["'\''[:space:]]+$/, "", line)
        print line; exit } }
  ' "$1"
}

# Print the body (everything after the closing frontmatter `---`).
body_of() {
  awk 'BEGIN{fm=0; started=0}
    NR==1 && $0=="---" { fm=1; next }
    fm==1 && $0=="---" { fm=0; started=1; next }
    started==1 || fm==0 { print }
  ' "$1"
}

total_files=0
declare_projects=""
type_counts=""
blocks=""

while IFS= read -r dir; do
  [[ -z "$dir" ]] && continue
  [[ -d "$dir" ]] || continue
  proj="$(project_of "$dir")"
  shopt -s nullglob
  files=("$dir"/*.md)
  shopt -u nullglob
  [[ ${#files[@]} -gt 0 ]] || continue

  for f in "${files[@]}"; do
    base="$(basename "$f")"
    [[ "$base" == "MEMORY.md" ]] && continue
    mt="$(mtime_epoch "$f")"; age=$(( (now - mt) / 86400 ))
    (( age < MIN_AGE )) && continue

    name="$(fm "$f" name)";        [[ -z "$name" ]] && name="(no-name)"
    type="$(fm "$f" type)";        [[ -z "$type" ]] && type="(untyped)"
    desc="$(fm "$f" description)";  [[ -z "$desc" ]] && desc="(no description)"

    total_files=$(( total_files + 1 ))
    declare_projects+="$proj"$'\n'
    type_counts+="$type"$'\n'
    blocks+="=== [$proj · ${type} · ${age}d] $base ==="$'\n'
    blocks+="name: $name"$'\n'
    blocks+="description: $desc"$'\n'
    blocks+="---"$'\n'
    blocks+="$(body_of "$f")"$'\n\n'
  done
done < <(discover | awk '!seen[$0]++')

if [[ "$total_files" -eq 0 ]]; then
  if [[ "$MODE" == "current" ]]; then
    echo "No memories found for the current project." >&2
    echo "Pass a dir explicitly (--dir <path>) or scan every project (--all)." >&2
  else
    echo "No memories found." >&2
    echo "Try: gather-memories.sh --dir <path>" >&2
  fi
  exit 0
fi

uniq_projects="$(printf '%s' "$declare_projects" | sort -u | grep -c . || true)"
type_summary="$(printf '%s' "$type_counts" | sort | uniq -c | awk '{printf "%s=%s ", $2, $1}')"

noun="projects"; [[ "$uniq_projects" -eq 1 ]] && noun="project"
printf '# %d memories across %d %s · types: %s\n\n' \
  "$total_files" "$uniq_projects" "$noun" "$type_summary"
printf '%s' "$blocks"
