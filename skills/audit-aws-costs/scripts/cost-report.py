#!/usr/bin/env python3
"""Pretty-print `aws ce get-cost-and-usage` JSON (from stdin) by group, biggest first.

Works for any single GROUP-BY dimension (SERVICE, REGION, USAGE_TYPE, ...).
Filtering of tiny/zero amounts happens here, in Python, because JMESPath
`--query` cannot do numeric comparisons against Cost Explorer's string amounts.
"""
import sys
import json


def main() -> None:
    data = json.load(sys.stdin)
    for period in data.get("ResultsByTime", []):
        tp = period["TimePeriod"]
        print(f"\n{tp['Start']} -> {tp['End']}")
        rows = []
        for g in period.get("Groups", []):
            amt = float(g["Metrics"]["UnblendedCost"]["Amount"])
            if amt > 0:
                rows.append((g["Keys"][0], amt))
        if not rows:
            print("  (no charges)")
            continue
        total = sum(a for _, a in rows)
        for key, amt in sorted(rows, key=lambda x: -x[1]):
            print(f"  ${amt:10.4f}  {key}")
        print(f"  {'-' * 12}")
        print(f"  ${total:10.4f}  TOTAL")


if __name__ == "__main__":
    main()
