---
"@zcaceres/skill-quality-openssf": minor
---

New skill `quality-openssf` — scaffolds the OpenSSF Scorecard GitHub
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
