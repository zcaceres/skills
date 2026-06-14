---
"@zcaceres/skill-security-gitleaks": major
---

Rename `quality-gitleaks` to `security-gitleaks` so it groups with the other
security skills (`security-snyk`, `security-socket`, `security-openssf`,
`security-bumblebee`):

- `skills/quality-gitleaks/` → `skills/security-gitleaks/`
- `@zcaceres/skill-quality-gitleaks` → `@zcaceres/skill-security-gitleaks`
- `/quality-gitleaks` slash command → `/security-gitleaks`

Breaking for installers: update `npx skills add -s quality-gitleaks` to
`-s security-gitleaks`. Repos that already ran the skill keep working — the
installed `.gitleaks.toml`, pre-commit hook, and CI workflow only referenced
the old name in comments.
