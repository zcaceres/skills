---
name: __SKILL_NAME__
description: __ONE_LINE_DESCRIPTION__
---

# __SKILL_NAME__

Replace this body with the skill's instructions. The `name` above MUST match
the parent folder name exactly. The `description` is what the agent reads to
decide whether to activate the skill — say both *what* it does and *when* to
use it.

Optional frontmatter fields (Claude Code-specific unless noted; ignored by
agents that don't support them):

- `when_to_use` — extended activation rules
- `allowed-tools` — restrict which tools the skill may call
- `context: fork` — run as an isolated subagent
- `effort: low | medium | high`
- `disable-model-invocation: true` — only activates via explicit `/__SKILL_NAME__`
- `hooks` — event-driven triggers
- `license`, `compatibility`, `metadata`

## Directory layout

- `scripts/` — executables this skill can call
- `references/` — docs the skill reads for additional context
- `assets/` — templates, sample files, other resources
- `agents/openai.yaml` — Codex CLI metadata (optional)
