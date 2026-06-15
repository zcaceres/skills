# quality-chaos-monkey

Claude Code skill for systematically tracing every code path in a focus
area, applying 10 chaos categories (boundary inputs, state consistency,
error handling, race conditions, logic errors, data flow, resource
management, implicit assumptions, dead code, security boundaries), and
producing a structured markdown report with file:line citations and a
confidence rating per finding.

When the focus area involves frontend code or paths too complex to
verify statically, the skill escalates to runtime browser testing via
the Playwright or Chrome DevTools MCP tools — exercising chaos inputs
on the live app, forcing error states, and checking console + network.

See [SKILL.md](./SKILL.md) for the workflow, the 10 categories, and the
report format.

## Install

```sh
npx skills add zcaceres/skills -s quality-chaos-monkey
```

This is a pure-markdown skill — no binaries, no install-time side effects.
