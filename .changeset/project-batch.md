---
"@zcaceres/skill-project": minor
---

Add a `batch` subcommand: apply one operation (create / update / delete) across many cards at once, with a single holistic preview, one confirmation, a continue-on-error apply loop, and a per-item tally. It's an envelope that reuses the per-card recipes from new-task / update / delete and preserves every single-card safety rule (typed `yes` on delete, no auto-resolving ambiguous selectors across a set, the "move finished cards to Done, don't delete" norm). Adds a `find-many` helper to the github board script for resolving many selectors in one board fetch. Backend-neutral: the linear backend resolves and applies through the Linear MCP.
