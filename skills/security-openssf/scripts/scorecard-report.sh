#!/usr/bin/env bash
#
# scorecard-report.sh — render a readable OpenSSF Scorecard report from a
# SARIF artifact.
#
# Why this exists: the installed workflow runs Scorecard with
# `results_format: sarif`, which does NOT print an aggregate score to the
# Actions log — the `Aggregate score: X/10` line only appears with the
# `default`/`json` output formats. SARIF still carries everything you need to
# triage, though: each check's score is embedded in its result message
# ("score is N: ...") and per-check severity lives in the rule's
# `security-severity` property. This script turns that into a readable table.
#
# Usage:
#   scorecard-report.sh path/to/results.sarif   # render a local SARIF file
#   scorecard-report.sh --fetch [owner/repo]    # download the latest Scorecard
#                                               # run's SARIF, then render it
#
# Requires: jq. `--fetch` also requires gh (authenticated). Defaults the repo
# to the current directory's GitHub remote.
set -euo pipefail

die() { echo "error: $*" >&2; exit 1; }
command -v jq >/dev/null || die "jq is required"

SARIF=""
CLEANUP_DIR=""
trap '[ -n "$CLEANUP_DIR" ] && rm -rf "$CLEANUP_DIR"' EXIT

if [ "${1:-}" = "--fetch" ]; then
  command -v gh >/dev/null || die "--fetch requires gh"
  REPO="${2:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
  [ -n "$REPO" ] || die "could not resolve repo; pass owner/repo"
  RUN_ID=$(gh run list --repo "$REPO" --workflow scorecard.yml \
    --status success --limit 1 --json databaseId -q '.[0].databaseId')
  [ -n "$RUN_ID" ] || die "no successful Scorecard run found for $REPO"
  CLEANUP_DIR=$(mktemp -d)
  gh run download "$RUN_ID" --repo "$REPO" -n "SARIF file" -D "$CLEANUP_DIR" \
    || die "could not download 'SARIF file' artifact from run $RUN_ID (expired?)"
  SARIF=$(find "$CLEANUP_DIR" -name '*.sarif' | head -1)
  [ -n "$SARIF" ] || die "no .sarif file in the downloaded artifact"
  echo "Scorecard report for $REPO (run $RUN_ID)"
else
  SARIF="${1:-}"
  [ -n "$SARIF" ] || die "usage: scorecard-report.sh <results.sarif> | --fetch [owner/repo]"
  [ -f "$SARIF" ] || die "no such file: $SARIF"
fi

# Build a TSV of every check that ran: failing checks (with a finding) carry
# their score + the first line of the reason; checks with no finding pass.
# Columns: sortkey \t status \t severity \t name \t score \t reason
ROWS=$(jq -r '
  ( [ .runs[].results[]?
      | { id: .ruleId,
          score: ((.message.text | capture("score is (?<s>-?[0-9]+)") | .s | tonumber) // 0),
          reason: (.message.text | split("\n")[0] | sub("^score is -?[0-9]+: "; "")) } ]
  ) as $found
  | ( [ .runs[].tool.driver.rules[]?
        | { id: .id, name: .name,
            sev: ((.properties["security-severity"] // "0") | tonumber) } ]
      | unique_by(.id) ) as $rules
  | $rules[] as $r
  | ($found | map(select(.id == $r.id))) as $f
  | if ($f|length) > 0
    then "\($r.sev)\tFAIL\t\($r.sev)\t\($r.name)\t\($f[0].score)/10\t\($f[0].reason)"
    else "-1\tok\t\($r.sev)\t\($r.name)\t10/10\t—"
    end
' "$SARIF")

FAILS=$(printf '%s\n' "$ROWS" | awk -F'\t' '$2=="FAIL"' | sort -t$'\t' -k1,1 -rn)
PASSES=$(printf '%s\n' "$ROWS" | awk -F'\t' '$2=="ok"' | sort -t$'\t' -k4,4)

fail_n=$(printf '%s\n' "$FAILS" | grep -c . || true)
pass_n=$(printf '%s\n' "$PASSES" | grep -c . || true)

echo
echo "NEEDS ATTENTION ($fail_n checks with findings, highest severity first):"
echo
printf '%s\n' "$FAILS" | awk -F'\t' 'NF>1 {printf "  [sev %-3s] %-22s %-7s %s\n", $3, $4, $5, $6}'
echo
echo "PASSING / NOT APPLICABLE ($pass_n checks):"
printf '%s\n' "$PASSES" | awk -F'\t' 'NF>1 {printf "  %s\n", $4}' | paste -sd' ' -
echo
echo "Note: SARIF carries per-check scores but not the weighted aggregate."
echo "For the exact 0-10 aggregate, run Scorecard locally with a non-SARIF format:"
echo "  scorecard --repo=github.com/<owner>/<repo> --format=default   # needs \$GITHUB_TOKEN"
