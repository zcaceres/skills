# @zcaceres/skill-acid-trip

## 1.0.0

### Major Changes

- Initial release: Claude Code slash command for design rituals driven by
  real-world entropy. A Python roller (`scripts/roll.py`) picks two
  structural axes (`document_type` + `lineage`) from curated lists via
  `/dev/urandom`; Wikipedia's `Special:Random` endpoint supplies a subject.
  Palette, typography, layout, and mood are _derived_ from the article ×
  lineage collision — never rolled separately. The skill runs as a two-
  phase ritual: **Trip → pause → Realize**, with a mandatory self-critique
  pass that audits against a hard blacklist and a forbidden-micro-anatomy
  list before stamping provenance.

  Ported from
  [`zcaceres/claude-acid-trip`](https://github.com/zcaceres/claude-acid-trip).
  Two mechanical path updates: `~/.claude/skills/acid-trip/roll.py` →
  `${CLAUDE_SKILL_DIR}/scripts/roll.py` (so the script resolves correctly
  under both personal and project installs). Body, blacklist, ritual rules,
  and provenance-stamp format are preserved verbatim.
