---
"@zcaceres/skill-clean-ai-slop": major
---

Add clean-ai-slop — finds AI-generated noise in the current branch's diff,
proposes each finding interactively, applies only what's approved, and
verifies with the project's typecheck and tests. Scope: tombstone comments,
restating-the-code comments, callsite references, emoji/em-dash tells,
unused imports, dead internal symbols. Explicitly leaves `try/catch`,
`any` casts, and redundant extractions alone — those belong to `/simplify`
or `/code-review`. Ports the current `clean-ai-slop` slash command from
`~/.claude/commands/`.
