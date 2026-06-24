# @zcaceres/skill-quality-docs-update

## 0.1.0

### Minor Changes

- cd966a7: Add `quality-docs-update`: a Claude Code slash command that audits project
  documentation against the codebase and produces a structured revision plan.
  Discovers all docs, fans out parallel Explore agents to verify claims against
  the actual code, diffs documentation vs reality, and applies approved fixes
  with surgical edits. Triggered via `/quality-docs-update`.
