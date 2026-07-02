# @zcaceres/skill-audit-memories

## 0.1.0

### Minor Changes

- 2b8ef84: Add `audit-memories`: a guided review for an AI agent's saved memories. Default
  target is Claude Code's per-project memory store
  (`~/.claude/projects/<cwd>/memory/`), but it handles any file-based memory dir.
  The bundled `scan-memories.sh` inventories a store from frontmatter only (cheap
  for large stores): counts by type, age buckets, and orphan detection (files
  missing from `MEMORY.md`), one row per memory sorted oldest-first. The skill then
  flags stale / contradictory / redundant / orphaned memories — verifying every
  code citation against the _current_ repo before flagging, so a correct
  point-in-time memory isn't deleted because its text merely looked outdated — and
  walks the user through keep / update / merge / delete decisions one at a time. It
  curates rather than purges: the agent proposes, the user disposes, nothing is
  deleted without per-item confirmation, and the store is backed up before any
  destructive edit. Model-invocable and via `/audit-memories`.
