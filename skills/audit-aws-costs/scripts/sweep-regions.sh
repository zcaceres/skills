#!/usr/bin/env bash
# Sweep CloudTrail write events (ReadOnly=false) across all enabled regions.
# Usage: bash sweep-regions.sh [DAYS]   (default 30)
# Read-only: only calls describe-regions and cloudtrail lookup-events.
set -euo pipefail

DAYS="${1:-30}"

# GNU date first, BSD date as fallback.
if START=$(date -u -d "${DAYS} days ago" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null); then :; else
  START=$(date -u -v-"${DAYS}"d +%Y-%m-%dT%H:%M:%SZ)
fi

regions=$(aws ec2 describe-regions --all-regions \
  --query 'Regions[?OptInStatus!=`not-opted-in`].RegionName' --output text)

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

for r in $regions; do
  (
    out=$(aws cloudtrail lookup-events --region "$r" \
      --lookup-attributes AttributeKey=ReadOnly,AttributeValue=false \
      --start-time "$START" --page-size 50 \
      --query 'Events[].{Time:EventTime,Event:EventName,Source:EventSource,User:Username}' \
      --output text 2>/dev/null || true)
    [ -n "$out" ] && echo "$out" | sed "s/^/$r\t/" > "$tmp/$r"
  ) &
done
wait

echo "=== Write events (region | time | event | source | user), last ${DAYS}d ==="
if compgen -G "$tmp/*" > /dev/null; then
  cat "$tmp"/* | sort -k2 | column -t -s$'\t'
  echo ""
  echo "=== Per-region write-event counts ==="
  for f in "$tmp"/*; do echo "$(basename "$f"): $(wc -l < "$f" | tr -d ' ')"; done
else
  echo "(no write events in any region — nothing was provisioned in this window)"
fi
