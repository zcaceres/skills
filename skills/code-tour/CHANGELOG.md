# @zcaceres/skill-code-tour

## 0.1.0

### Minor Changes

- c49f3ff: Add `code-tour`: a Claude Code slash command that walks an unfamiliar codebase
  and writes a concise `CODE_TOUR.md` onboarding guide. Orients from the README and
  package manifests, fans out parallel Explore agents to map entry points, core
  domain, data/state, integrations, and build/ops, then synthesises the spine into
  one tight document — the 5–9 components that matter, a Mermaid diagram of how they
  connect, a walkthrough of one end-to-end flow, and the areas worth a closer look
  to understand it — conventions to follow, non-obvious wiring, and open questions —
  all with clickable `file:line` breadcrumbs. Descriptive, not evaluative: it writes
  a single artifact and never reviews or modifies source. Slash-command-only
  (`disable-model-invocation: true`) — it runs only when you invoke `/code-tour
[path-to-tour]`, never auto-activated by the model.
