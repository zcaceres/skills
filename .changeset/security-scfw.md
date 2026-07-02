---
"@zcaceres/skill-security-scfw": minor
---

Add `security-scfw`: set up Datadog's Supply-Chain Firewall (`scfw`) as a
client-side, install-time gate that blocks known-malicious npm/PyPI/Poetry
packages before they install (checked against Datadog's malicious-packages
dataset + OSV.dev). Setup mode installs scfw via `pipx`, runs `scfw configure`
to alias `pip`/`npm`/`poetry` through the firewall, smoke-tests the pipeline
with a dry run, and optionally installs a Claude Code PreToolUse hook that
denies the agent's own un-wrapped installs (routing them through `scfw run`)
and flags bun/pnpm installs as outside the firewall's coverage. Review mode
confirms the wiring, reads the local JSON Lines log for recent blocks/warnings,
audits installed packages, and answers advisory lookups. User-triggered only.
