---
"@zcaceres/skill-boilerplate-openssf": patch
---

`boilerplate-openssf` now refuses to install on private/internal repos —
no escape hatch, no "going public soon" path. Empirical reason: the
Scorecard action hard-fails before producing SARIF when the default
`GITHUB_TOKEN` hits a private repo (`Resource not accessible by
integration` on the GraphQL setup), so the previous "private repos still
get phase-1 cleanup" path was producing nothing but weekly failure
emails. Skill detects visibility, surfaces the actual failure mode, and
stops the session. Phase 2 still requires public + a clean score.
