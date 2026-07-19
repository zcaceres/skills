# @zcaceres/skill-quality-project-health

## 0.1.1

### Patch Changes

- 6a74c32: Point the board snapshot at the new `.project/` layout. The `gh-project` →
  `project` rename moved the config and helper to `.project/config.json` and
  `.project/scripts/board.sh`, so the health report's Step 5 existence check now
  also looks there (keeping the legacy `.github/gh-project.json` +
  `.github/scripts/gh-project-board.sh` paths as a fallback). Without this, a
  repo migrated by `/project setup` silently dropped the board section from its
  health report.

## 0.1.0

### Minor Changes

- 8da0db6: New skill `quality-project-health` — ports the Claude project status prompt into
  a Codex-compatible slash skill. The skill gathers read-only evidence from git,
  obvious validation commands, project metadata, optional local `.context` notes,
  and the repo's GitHub Project board helper when present, then returns a compact
  status report with a 0-10 project health rating.
