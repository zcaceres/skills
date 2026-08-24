# @zcaceres/skill-security-gitleaks

## 1.0.2

### Patch Changes

- c3f46c3: Make Delta-exposed skills manual-invocation only

## 1.0.1

### Patch Changes

- cb98359: Add explicit Codex invocation metadata and documentation to the selected skills,
  plus native Codex hook installation for dotenv, 1Password credential, and
  Supply-Chain Firewall guards.

## 1.0.0

### Major Changes

- b05613e: Rename `quality-gitleaks` to `security-gitleaks` so it groups with the other
  security skills (`security-snyk`, `security-socket`, `security-openssf`,
  `security-bumblebee`):

  - `skills/quality-gitleaks/` → `skills/security-gitleaks/`
  - `@zcaceres/skill-quality-gitleaks` → `@zcaceres/skill-security-gitleaks`
  - `/quality-gitleaks` slash command → `/security-gitleaks`

  Breaking for installers: update `npx skills add -s quality-gitleaks` to
  `-s security-gitleaks`. Repos that already ran the skill keep working — the
  installed `.gitleaks.toml`, pre-commit hook, and CI workflow only referenced
  the old name in comments.
