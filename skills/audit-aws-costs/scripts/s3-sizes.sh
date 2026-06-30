#!/usr/bin/env bash
# List every S3 bucket with its region, creation date, and size.
# Size comes from the free CloudWatch BucketSizeBytes metric (last datapoint).
# Read-only: list-buckets, get-bucket-location, cloudwatch get-metric-statistics.
set -euo pipefail

if START=$(date -u -d '3 days ago' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null); then :; else
  START=$(date -u -v-3d +%Y-%m-%dT%H:%M:%SZ)
fi
END=$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u +%Y-%m-%dT%H:%M:%SZ)

printf "%-45s %12s  %-14s  %s\n" "BUCKET" "SIZE(GB)" "REGION" "CREATED"
aws s3api list-buckets --query 'Buckets[].[Name,CreationDate]' --output text |
while IFS=$'\t' read -r name created; do
  loc=$(aws s3api get-bucket-location --bucket "$name" --query 'LocationConstraint' --output text 2>/dev/null || echo "?")
  [ "$loc" = "None" ] && loc=us-east-1
  bytes=$(aws cloudwatch get-metric-statistics --region "$loc" \
    --namespace AWS/S3 --metric-name BucketSizeBytes \
    --dimensions Name=BucketName,Value="$name" Name=StorageType,Value=StandardStorage \
    --start-time "$START" --end-time "$END" --period 86400 --statistics Average \
    --query 'sort_by(Datapoints, &Timestamp)[-1].Average' --output text 2>/dev/null || echo "None")
  { [ "$bytes" = "None" ] || [ -z "$bytes" ]; } && bytes=0
  gb=$(awk -v b="$bytes" 'BEGIN{printf "%.2f", b/1024/1024/1024}')
  printf "%-45s %12s  %-14s  %s\n" "$name" "$gb" "$loc" "$created"
done
