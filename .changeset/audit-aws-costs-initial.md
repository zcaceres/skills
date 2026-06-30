---
"@zcaceres/skill-audit-aws-costs": major
---

Add `audit-aws-costs`: a read-only AWS cost-and-resource audit skill. Confirms
identity and enabled regions, sweeps CloudTrail write events across all regions
to surface recent provisioning, inventories the resources that bill while idle
(EBS, EIPs, NAT gateways, load balancers, RDS, ASGs, S3, and more), breaks down
Cost Explorer spend by service and region, drills into the top cost drivers, and
synthesizes a decision-ready report grouped into what's costing money, what was
recently provisioned, and idle/leftover clutter. Non-destructive by default —
teardown is a separate, explicit, per-resource step. Ships `sweep-regions`,
`cost-report`, and `s3-sizes` helper scripts plus a cost-driver cheat sheet.
