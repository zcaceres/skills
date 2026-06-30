---
name: audit-aws-costs
description: Read-only audit of AWS spend and recently provisioned resources. Sweeps CloudTrail for recent write activity across all regions, inventories billable resources, breaks down Cost Explorer spend by service, drills into the top cost drivers, and prints a decision-ready report. Never deletes anything by default. Use on "audit my AWS costs", "what am I running in AWS", "did I provision something by accident", "why is my AWS bill so high", "find idle AWS resources".
---

# Audit AWS Costs

Produce a clear, read-only picture of what exists in an AWS account, what it
costs, and what was provisioned recently — so the user can decide what to keep,
shut down, or delete. **This skill never deletes or modifies anything by
default.** It gathers facts and presents an audit; teardown only happens later,
on an explicit, per-resource request.

## When to Use This Skill

- "Audit my AWS costs" / "why is my AWS bill so high?"
- "What am I running in AWS?" / "What's provisioned in my account?"
- "Did I accidentally provision something with my credentials?"
- "Find idle / zombie / leftover AWS resources"
- "What can I safely shut down or delete?"

## Safety Philosophy

This skill is **strictly read-only**:

- Every command is a `describe`, `list`, `lookup`, `get`, or Cost Explorer
  query. No `create`, `run`, `delete`, `terminate`, `put`, or `modify`.
- Never delete or stop anything as part of the audit, even if a resource looks
  obviously wasteful. Surface it; let the user decide.
- If the user asks to tear something down afterward, treat that as a separate
  action: confirm the exact resource, explain the blast radius, and only then
  act. Prefer deleting through the owning abstraction (CloudFormation /
  Terraform / CDK stack) over picking off individual resources.
- Report cost figures as what they are — actuals from Cost Explorer, not
  estimates — and label any back-of-envelope math clearly as an estimate.

## Prerequisites

- AWS CLI v2 configured with working credentials (`aws configure list`).
- The audit reads from CloudTrail, Cost Explorer, and per-service `describe`
  APIs. Cost Explorer (`ce:GetCostAndUsage`) must be enabled on the account and
  the principal needs read access to it. If Cost Explorer is denied, skip that
  section and rely on the resource inventory plus a clearly-labelled estimate.

## Environment Gotchas (read before running commands)

These bit a real run; bake them in:

- **`date`**: the user may have GNU coreutils on macOS, so BSD `date -v-7d`
  can fail. Prefer GNU syntax `date -u -d '30 days ago' +%Y-%m-%dT%H:%M:%SZ`.
  If that errors, fall back to BSD `date -u -v-30d +%Y-%m-%dT%H:%M:%SZ`.
- **zsh reserved words**: in zsh, `status` is read-only — never use it as a
  shell variable name in a loop. Use `st` or similar.
- **Inline Python + AWS `--query`**: avoid heredoc/inline Python with escaped
  quotes (the shell mangles `\"`). Write a small `.py` file (see
  `scripts/cost-report.py`) instead. Also avoid numeric comparisons inside
  JMESPath `--query` against cost amounts — the values arrive as strings and
  `>` comparisons error. Filter numbers in Python after the fact.
- **CloudTrail is per-region and paged**: `lookup-events` returns only the
  calling region's events, 50 per page. Sweep every enabled region, and let the
  AWS CLI walk every page — pass `--page-size 50`, not `--max-results 50`. The
  latter is the service-level cap, which **disables** the CLI's automatic
  pagination and silently truncates a busy region to a single 50-event page.
  `scripts/sweep-regions.sh` already uses `--page-size`.

## Workflow

### 1. Identity and scope

Confirm who you are and where you're looking before reporting anything.

```bash
aws sts get-caller-identity
aws configure get region
# Enabled regions (excludes opted-out regions):
aws ec2 describe-regions --all-regions \
  --query 'Regions[?OptInStatus!=`not-opted-in`].RegionName' --output text
```

State the account ID and principal back to the user — an "accidental
provisioning" worry is often really "which account/identity was I using?"

### 2. Recent provisioning — CloudTrail write-event sweep

CloudTrail is the authoritative log of every API call. Filter to **write**
events (`ReadOnly=false`) over a 30-day window across **all** enabled regions.
Use `scripts/sweep-regions.sh`, or inline:

```bash
bash scripts/sweep-regions.sh 30
```

Interpreting the output:

- Group by region and event name. `Create*`, `Run*`, `Put*`, `Allocate*` are
  provisioning. Note the **Username** column — was it the human IAM user, an
  assumed role, or an AWS **service** principal (a name ending in
  `.amazonaws.com`)?
- Service-driven write events with no matching human action usually mean an
  existing resource (a scaling group, a scheduled job, a deployment) is acting
  on its own — often a sign of a leftover that keeps retrying. Trace it to the
  resource that owns it rather than stopping at the event.
- To answer "did *I* provision this?", filter by the human user:
  `--lookup-attributes AttributeKey=Username,AttributeValue=<iam-user>`. If the
  only recent events for that user are read-only (`Get*`, `Describe*`,
  `List*`), they provisioned nothing recently — say so plainly.

### 3. Actual spend — Cost Explorer

Get real dollars by service, then by region, for the last two months:

```bash
# By service
aws ce get-cost-and-usage --region us-east-1 \
  --time-period Start=$(date -u -d '60 days ago' +%Y-%m-%d),End=$(date -u +%Y-%m-%d) \
  --granularity MONTHLY --metrics UnblendedCost \
  --group-by Type=DIMENSION,Key=SERVICE --output json \
  | python3 scripts/cost-report.py

# By region (re-run the python with the same JSON shape)
aws ce get-cost-and-usage --region us-east-1 \
  --time-period Start=$(date -u -d '60 days ago' +%Y-%m-%d),End=$(date -u +%Y-%m-%d) \
  --granularity MONTHLY --metrics UnblendedCost \
  --group-by Type=DIMENSION,Key=REGION --output json \
  | python3 scripts/cost-report.py
```

The service breakdown is the single most useful signal: it tells you whether
the bill is storage, compute, data transfer, databases, or something else —
which determines where to drill in step 5.

### 4. Billable-resource inventory

Enumerate the resource kinds that **cost money even when idle**, in each region
that showed spend or recent activity (and your default region). For each, list
id, state, size/type, and creation/launch time:

```bash
R=<region>
aws ec2 describe-instances --region $R \
  --query 'Reservations[].Instances[].{Id:InstanceId,Type:InstanceType,State:State.Name,Launched:LaunchTime}' --output table
aws ec2 describe-volumes --region $R \
  --query 'Volumes[].{Id:VolumeId,GiB:Size,State:State,Attached:Attachments[0].InstanceId}' --output table
aws ec2 describe-addresses --region $R \
  --query 'Addresses[].{IP:PublicIp,Associated:AssociationId}' --output table   # unassociated EIPs bill hourly
aws ec2 describe-nat-gateways --region $R \
  --query 'NatGateways[?State==`available`].NatGatewayId' --output table         # ~$32+/mo each
aws elbv2 describe-load-balancers --region $R --query 'LoadBalancers[].LoadBalancerName' --output table
aws elb   describe-load-balancers --region $R --query 'LoadBalancerDescriptions[].LoadBalancerName' --output table
aws rds   describe-db-instances --region $R \
  --query 'DBInstances[].{Id:DBInstanceIdentifier,Class:DBInstanceClass,Engine:Engine,Status:DBInstanceStatus}' --output table
aws autoscaling describe-auto-scaling-groups --region $R \
  --query 'AutoScalingGroups[].{Name:AutoScalingGroupName,Min:MinSize,Max:MaxSize,Desired:DesiredCapacity,Running:length(Instances)}' --output table
aws cloudformation describe-stacks --region $R \
  --query 'Stacks[].{Name:StackName,Status:StackStatus,Created:CreationTime}' --output table
```

See `references/cost-drivers.md` for the full cheat sheet of what bills while
idle and the per-region vs. global services.

### 5. Drill into the top cost drivers

For whatever dominates step 3, get specifics. Examples:

- **Storage-dominated bill** → list buckets, their region, and sizes. Pull
  `BucketSizeBytes` from CloudWatch (free to query) with
  `bash scripts/s3-sizes.sh`. Flag the largest and newest buckets.
- **Compute-dominated** → which instances/ASGs are actually running vs.
  desired-but-failing. An ASG with `Desired>0` but `Running=0` is usually a
  zombie failing to launch; check `aws autoscaling describe-scaling-activities`
  for the failure reason.
- **Database-dominated** → RDS instance class, storage, and whether anything
  connects to it.

### 6. Produce the audit report

Synthesize everything into a single, skimmable report. **Do not just dump
command output.** Lead with the verdict, then the evidence. Suggested shape:

```
## AWS audit — account <id> (<principal>), <date>

**Bottom line:** <1–2 sentences: total recent spend, top driver, and whether
anything was provisioned recently / unexpectedly.>

### 💸 What's costing money
| Resource | Region | Size/Type | ~Monthly | Created | Notes |
| ...sorted by cost, biggest first... |

### 🆕 Recently provisioned (last 30d)
| Resource | Region | By whom | When |
| ...from the CloudTrail sweep; empty is a valid, reassuring answer... |

### 🧟 Idle / zombie / leftover (low or zero cost, but cruft)
| Resource | Region | Why it looks abandoned |

### ✅ Suggested decisions (no action taken)
- Keep: ...
- Review: ...
- Candidate to shut down / delete: ... (and the single command the user could
  run, presented as a suggestion — not executed)
```

Rules for the report:

- Sort the cost table by dollars, descending. Money first.
- "Nothing was recently provisioned" / "no idle billable resources" are
  valuable, reassuring findings — state them explicitly rather than omitting.
- Distinguish **costs money** from **just clutter**. A leftover that bills $0
  (e.g. an ASG whose launches all fail) is noise, not spend — say so.
- Every teardown is a *suggestion the user can run*, never something this skill
  performs. End by asking which, if any, they want help removing.

## If the user then asks to remove something

Only on an explicit request, and one resource (or stack) at a time:

1. Show exactly what will be destroyed and its dependencies
   (`aws cloudformation describe-stack-resources`, or describe the resource).
2. Prefer deleting via the owning IaC stack so dependencies tear down in order.
3. Watch for orphans not managed by the stack (e.g. resources a deployment
   service spun up as copies) and for phantom references to already-deleted
   infrastructure — these can block a stack delete and may need
   `--retain-resources` on the failed resource after you confirm the underlying
   thing is truly gone.
4. Verify the end state with `describe`/`list` and report what remains.

These cleanup steps are out of scope for the audit itself — the audit stops at
recommendations.
