# @zcaceres/skill-quality-chaos-monkey

## 1.0.0

### Major Changes

- Initial release: Claude Code skill for systematically tracing every code
  path in a focus area, applying 10 chaos categories (boundary inputs,
  state consistency, error handling, race conditions, logic errors, data
  flow, resource management, implicit assumptions, dead code, security
  boundaries), and producing a structured markdown report with file:line
  citations and a confidence rating per finding. When the focus area
  involves frontend code or paths too complex to verify statically, the
  skill escalates to runtime browser testing via Playwright / Chrome
  DevTools MCP tools. Pure-markdown skill — no binaries.

  Ported from the user's local `~/.claude/skills/chaos-monkey/` into this
  monorepo. Body preserved verbatim.
