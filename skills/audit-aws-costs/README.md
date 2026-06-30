# audit-aws-costs

Claude Code skill for a **read-only** audit of an AWS account: what's running,
what it costs, and what was provisioned recently — so you can decide what to
keep, shut down, or delete. It sweeps CloudTrail for write activity across every
enabled region, inventories the resources that bill while idle, breaks down Cost
Explorer spend by service and region, drills into the top cost drivers, and
prints a single decision-ready report.

**Non-destructive by design** — the audit never stops, deletes, or modifies
anything. Teardown only happens later, on an explicit per-resource request.

See [SKILL.md](./SKILL.md) for the full workflow, the helper scripts under
[`scripts/`](./scripts), and the cost-driver cheat sheet in
[`references/cost-drivers.md`](./references/cost-drivers.md).

## Install

```sh
npx skills add zcaceres/skills -s audit-aws-costs
```

Pure-markdown skill plus small bash/python helpers — no binaries.

## Requirements

- AWS CLI v2 with configured credentials.
- Read access to CloudTrail, Cost Explorer (`ce:GetCostAndUsage`), and
  per-service `describe`/`list` APIs.
