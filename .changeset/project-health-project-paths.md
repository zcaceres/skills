---
"@zcaceres/skill-quality-project-health": patch
---

Point the board snapshot at the new `.project/` layout. The `gh-project` →
`project` rename moved the config and helper to `.project/config.json` and
`.project/scripts/board.sh`, so the health report's Step 5 existence check now
also looks there (keeping the legacy `.github/gh-project.json` +
`.github/scripts/gh-project-board.sh` paths as a fallback). Without this, a
repo migrated by `/project setup` silently dropped the board section from its
health report.
