# @zcaceres/skill-zoom

## 1.0.0

### Major Changes

- Initial release: Claude Code slash command for shifting the conversation's
  abstraction level along a 7-rung ladder (expression → block → function →
  file → module → subsystem → system, plus product/domain above). Invoked as
  `/zoom in|out [target | rung | count]` — the first arg picks the direction,
  the rest is parsed identically to the upstream `/zoom-in` / `/zoom-out`
  pair. Header on every reply announces the move (`**Zoom in ▸ module →
function · …**`).

  Consolidated from
  [`zcaceres/claude-zoom-in-out`](https://github.com/zcaceres/claude-zoom-in-out),
  which shipped `/zoom-in` and `/zoom-out` as two distinct slash commands.
  This port packages them as a single skill so the abstraction ladder,
  parsing rules, edge cases, and output format are defined in one place.
  Direction-specific emphasis lives in `## When zooming in` / `## When
zooming out` sections.
