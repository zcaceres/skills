---
"@zcaceres/skill-memory-insights": major
---

Add `memory-insights`: reads everything the agent remembers about the user, then
hands back a few one-sentence pieces of feedback — constructive or observational
— that aren't obvious to them. The bundled `gather-memories.sh` dumps full memory
bodies into one stream; by default it reads the current project's
`~/.claude/projects/<proj>/memory/` store, and `--all` spans every project (plus
the global one). The skill reads the whole corpus and infers the person behind
the operational notes (temperament, values, instincts, blind spots) rather than
summarizing the store. Read-only — it never edits or deletes a memory (that's
`audit-memories`) and isn't a per-session retrospective (that's
`reflect-on-conversation`). Model-invocable and via `/memory-insights`.
