---
"@zcaceres/skill-clean-ai-slop": major
---

Add clean-ai-slop — diffs the current branch against `main` and strips
AI-generated slop: extra comments a human wouldn't add, defensive `try/catch`
around already-validated codepaths, `any`-casts that paper over type errors,
and any style inconsistent with the surrounding file. Ends with a 1–3 sentence
summary instead of a per-file breakdown. Ported from the `clean-ai-slop`
slash command in `~/.claude/commands/`.
