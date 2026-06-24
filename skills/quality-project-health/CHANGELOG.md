# @zcaceres/skill-quality-project-health

## 0.1.0

### Minor Changes

- 8da0db6: New skill `quality-project-health` — ports the Claude project status prompt into
  a Codex-compatible slash skill. The skill gathers read-only evidence from git,
  obvious validation commands, project metadata, optional local `.context` notes,
  and the repo's GitHub Project board helper when present, then returns a compact
  status report with a 0-10 project health rating.
