# @zcaceres/skill-security-openssf

## 0.1.0

### Minor Changes

- 63815c0: New skill `security-openssf` — scaffolds the OpenSSF Scorecard GitHub
  Action with a two-phase rollout. Phase 1 installs the workflow with
  `publish_results: false` so findings stay in the repo's Security tab and
  the score never reaches scorecard.dev. The user triages on their own time.
  Phase 2 (a separate session) flips publishing on and adds the badge once
  the score is acceptable. Declines on private/internal repos by default —
  the public-score value proposition doesn't apply and the SARIF surface
  mostly duplicates CodeQL + Dependabot. Ships a SHA-pinned workflow
  template and an in-prompt triage cheat-sheet for the highest-leverage
  check fixes (Token-Permissions, Pinned-Dependencies, Branch-Protection,
  etc.).
- 964bd60: Add a `scorecard-report.sh` renderer, a `fix` subcommand, and stop telling
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

### Patch Changes

- 63815c0: `security-openssf` now refuses to install on private/internal repos —
  no escape hatch, no "going public soon" path. Empirical reason: the
  Scorecard action hard-fails before producing SARIF when the default
  `GITHUB_TOKEN` hits a private repo (`Resource not accessible by
integration` on the GraphQL setup), so the previous "private repos still
  get phase-1 cleanup" path was producing nothing but weekly failure
  emails. Skill detects visibility, surfaces the actual failure mode, and
  stops the session. Phase 2 still requires public + a clean score.
