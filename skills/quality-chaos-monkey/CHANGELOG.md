# @zcaceres/skill-quality-chaos-monkey

## 2.0.0

### Major Changes

- 1cfaa29: Group the code-quality skills under a `quality-` prefix so they sort and read
  as a single category:

  - `chaos-monkey` -> `quality-chaos-monkey`
  - `cli-agent-friendly-audit` -> `quality-cli-agent-friendly-audit`
  - `code-cleanup-analyzer` -> `quality-dead-code-analyzer`
  - `perf-review` -> `quality-perf-review`

  Breaking for installers: update `npx skills add -s <old-name>` invocations to
  the new `quality-*` names. `quality-dead-code-analyzer` also gets a clearer
  name for its main job: repo-wide dead code, duplicate code, and circular
  dependency analysis.

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
