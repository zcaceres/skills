---
"@zcaceres/skill-security-openssf": minor
---

Add a `scorecard-report.sh` renderer, a `fix` subcommand, and stop telling
users to read an aggregate score that the workflow never emits.

The skill now dispatches subcommands: `install` (the existing two-phase
rollout, still the default) and `fix`, which takes the findings from a
Scorecard run, writes a bucketed remediation plan (file changes / repo
settings / won't-fix-N-A), stops at an approval gate, then applies the
file-based fixes and offers the settings-based ones.

On the report itself: The installed workflow runs
Scorecard with `results_format: sarif`, which means the Actions log has no
`Aggregate score: X/10` line — the old phase-1 instructions and phase-2 gate
both pointed users (and a `grep`) at a number that isn't there. The new script
parses the SARIF artifact (per-check scores live in each finding's message,
severity in the rule's `security-severity`) and prints a readable report:
failing checks with score + severity + reason, highest severity first, above
the passing ones. Run it with `--fetch <owner>/<repo>` to pull the latest run's
artifact, or pass a local `.sarif` file. The triage section, phase-1 next-steps,
phase-2 gate, and the workflow template comment all now point at the report
instead of the nonexistent log score; for the exact weighted aggregate the
report footer shows the local `scorecard --format=default` command.
