#!/usr/bin/env bash
# Inventory an AI agent's file-based memory store(s) without reading every body.
#
# Emits a per-directory summary (counts by type, age buckets) plus one TSV row
# per memory file, sorted oldest-first so stale candidates surface at the top.
# Frontmatter is parsed leniently with grep/awk — good enough for an overview;
# the calling agent reads full bodies only for the files it decides to inspect.
#
# Usage:
#   scan-memories.sh                 # current project's Claude memory dir
#   scan-memories.sh --all           # every Claude/Codex memory dir found
#   scan-memories.sh --dir <path>    # a specific memory dir (repeatable)
#
# TSV columns (tab-separated, after each "## <dir>" header):
#   AGE_DAYS  SIZE_B  INDEXED  TYPE  NAME  FILE  DESCRIPTION
#   INDEXED = yes/no — whether MEMORY.md references the file (orphan check).

set -euo pipefail

MODE="cwd"
DIRS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --all) MODE="all"; shift ;;
    --dir) MODE="explicit"; DIRS+=("$2"); shift 2 ;;
    -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

# Portable mtime-as-epoch. `stat` flags differ across BSD/GNU (and a brewed GNU
# stat on macOS makes `-f` mean filesystem), so use perl — always present on
# macOS and most Linux, same dependency extract-commands.sh leans on.
mtime_epoch() {
  perl -e 'print((stat $ARGV[0])[9] // 0)' "$1" 2>/dev/null || echo 0
}

now="$(date +%s)"

discover() {
  local root="${HOME}/.claude/projects"
  case "$MODE" in
    explicit) printf '%s\n' "${DIRS[@]}" ;;
    cwd)
      # The current project's per-project Claude memory dir. Claude encodes the
      # cwd by replacing every non-alphanumeric char (incl. `.`) with `-`.
      local enc; enc="$(pwd | sed 's|[^a-zA-Z0-9]|-|g')"
      printf '%s\n' "${root}/${enc}/memory"
      ;;
    all)
      # Every Claude per-project memory dir, plus common global/agent stores.
      find "$root" -maxdepth 2 -type d -name memory 2>/dev/null
      printf '%s\n' "${HOME}/.claude/memory" "${HOME}/.codex/memory"
      ;;
  esac
}

# Pull a single frontmatter field value (first match) from the top of a file.
# Matches `key:` at any indentation (so nested `metadata: type:` works).
fm() {
  awk -v key="$2" '
    NR==1 && $0!="---" { exit }              # no frontmatter block
    NR>1 && $0=="---"  { exit }              # end of frontmatter
    {
      line=$0
      sub(/^[[:space:]]+/, "", line)
      if (line ~ "^" key ":") {
        sub("^" key ":[[:space:]]*", "", line)
        gsub(/^["'\''[:space:]]+|["'\''[:space:]]+$/, "", line)
        print line; exit
      }
    }
  ' "$1"
}

scan_dir() {
  local dir="$1"
  [[ -d "$dir" ]] || return 0
  shopt -s nullglob
  local files=("$dir"/*.md)
  shopt -u nullglob
  [[ ${#files[@]} -gt 0 ]] || return 0

  local index="$dir/MEMORY.md"
  local index_text=""
  [[ -f "$index" ]] && index_text="$(cat "$index")"

  echo "## $dir"

  # Build rows into a buffer; tally afterwards with awk (macOS bash 3.2 has no
  # associative arrays).
  local rows=""
  for f in "${files[@]}"; do
    local base; base="$(basename "$f")"
    [[ "$base" == "MEMORY.md" ]] && continue

    local name type desc size mt age indexed
    name="$(fm "$f" name)";       [[ -z "$name" ]] && name="(no-name)"
    type="$(fm "$f" type)";       [[ -z "$type" ]] && type="(untyped)"
    desc="$(fm "$f" description)"; [[ -z "$desc" ]] && desc="(no description)"
    size="$(wc -c < "$f" | tr -d ' ')"
    mt="$(mtime_epoch "$f")"
    age=$(( (now - mt) / 86400 ))

    if [[ "$index_text" == *"$base"* || "$index_text" == *"$name"* ]]; then
      indexed="yes"
    else
      indexed="no"
    fi

    # Strip tabs/newlines from the description so the TSV stays one row.
    desc="$(printf '%s' "$desc" | tr '\t\n' '  ')"
    rows+="$(printf '%s\t%s\t%s\t%s\t%s\t%s\t%s' \
      "$age" "$size" "$indexed" "$type" "$name" "$base" "$desc")"$'\n'
  done

  # Summary line (totals, per-type counts, age buckets, orphan count).
  printf '# %s' "$(printf '%s' "$rows" | awk -F'\t' '
    NF<7 { next }
    { total++; tc[$4]++; if ($3=="no") orphan++
      if ($1<=7) b1++; else if ($1<=30) b2++; else if ($1<=90) b3++; else b4++ }
    END {
      printf "%d memories", total
      for (t in tc) printf "; %s=%d", t, tc[t]
      printf "; age: <=7d=%d <=30d=%d <=90d=%d older=%d", b1, b2, b3, b4
      if (orphan) printf "; NOT-in-index=%d", orphan
    }')"
  echo
  printf 'AGE_DAYS\tSIZE_B\tINDEXED\tTYPE\tNAME\tFILE\tDESCRIPTION\n'
  printf '%s' "$rows" | sort -t$'\t' -k1,1 -nr
  echo
}

found_any=0
while IFS= read -r d; do
  [[ -z "$d" ]] && continue
  if [[ -d "$d" ]]; then found_any=1; scan_dir "$d"; fi
done < <(discover | awk '!seen[$0]++')

if [[ "$found_any" -eq 0 ]]; then
  echo "No memory directory found for this mode." >&2
  echo "Try: scan-memories.sh --all   (or --dir <path> for a known store)" >&2
  exit 0
fi
