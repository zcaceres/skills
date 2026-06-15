---
"@zcaceres/skill-security-openssf-bestpractices": minor
---

New skill `security-openssf-bestpractices` — helps a FLOSS project earn the
OpenSSF Best Practices Badge (formerly CII) at the passing level. This is the
self-certification questionnaire at bestpractices.dev, distinct from the
automated Scorecard handled by `security-openssf`. Four phases: audit the repo
against the passing criteria (Met/Unmet/N/A with evidence URLs), close the
common gaps (SECURITY.md, CONTRIBUTING.md, build/test docs) from templates,
generate a fill-in worksheet of justifications and evidence URLs to paste into
the web form, then register and embed the badge. Self-attestation is treated as
load-bearing: the skill never fabricates a "Met" answer and never submits the
form on the user's behalf. Ships a full passing-criteria worksheet plus
SECURITY.md and CONTRIBUTING.md templates.
