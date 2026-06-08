# boilerplate-openssf

Scaffold the [OpenSSF Scorecard](https://github.com/ossf/scorecard) GitHub
Action in a repo with a deliberate two-phase rollout:

1. **Phase 1** — install with `publish_results: false`. Findings land in the
   repo's Security tab as SARIF; the aggregate score is in the Actions log.
   Nothing reaches `scorecard.dev`. The user triages privately.
2. **Phase 2** — once the score is acceptable, flip `publish_results: true`
   and add the badge to the README.

The skill stops between phases on purpose — a bad first public score is
hard to unwind because old scores stay in the dashboard history.

**Private/internal repos: declines by default.** The whole value
proposition (public score at scorecard.dev) doesn't apply, and the
remaining SARIF findings mostly duplicate CodeQL + Dependabot. The
skill only proceeds if the user confirms they're about to make the
repo public or have a specific reason to want it anyway.

Activates on "add OpenSSF", "set up Scorecard", "OpenSSF boilerplate", or
`/boilerplate-openssf`.

## Layout

- `SKILL.md` — workflow + triage cheat-sheet for the highest-impact checks
- `assets/scorecard.yml` — workflow template copied into the target repo
  with the SHA pin and default branch substituted

## Install

```
npx skills add zcaceres/skills -s boilerplate-openssf
```

Add `-g` for global install, or `-a <agent>` to target a specific agent.
