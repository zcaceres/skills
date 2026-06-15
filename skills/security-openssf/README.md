# security-openssf

Scaffold the [OpenSSF Scorecard](https://github.com/ossf/scorecard) GitHub
Action in a repo with a deliberate two-phase rollout:

1. **Phase 1** — install with `publish_results: false`. Findings land in the
   repo's Security tab as SARIF (the SARIF run prints no aggregate score to the
   Actions log; use `scripts/scorecard-report.sh` for a readable per-check view).
   Nothing reaches `scorecard.dev`. The user triages privately.
2. **Phase 2** — once the score is acceptable, flip `publish_results: true`
   and add the badge to the README.

The skill stops between phases on purpose — a bad first public score is
hard to unwind because old scores stay in the dashboard history.

**Subcommand `fix`** (`/security-openssf fix`) turns a Scorecard report into
a bucketed remediation plan — file changes, repo settings, won't-fix/N-A —
then applies the file-based fixes after an approval gate.

**Private/internal repos: refuses outright.** The default `GITHUB_TOKEN`
can't run Scorecard's GraphQL queries on a private repository, so the
action hard-fails before producing any SARIF — installing it on a
private repo generates nothing but weekly failure notifications. The
skill stops the session with a one-line explanation instead.

Activates on "add OpenSSF", "set up Scorecard", "OpenSSF boilerplate", or
`/security-openssf`.

## Layout

- `SKILL.md` — subcommand dispatcher + `install` workflow + triage cheat-sheet
- `references/fix.md` — the `fix` subcommand: report → plan → apply
- `assets/scorecard.yml` — workflow template copied into the target repo
  with the SHA pin and default branch substituted
- `scripts/scorecard-report.sh` — render a readable per-check report from a
  SARIF artifact (`--fetch <owner>/<repo>` to pull the latest run, or pass a
  local `.sarif` file)

## Install

```
npx skills add zcaceres/skills -s security-openssf
```

Add `-g` for global install, or `-a <agent>` to target a specific agent.
