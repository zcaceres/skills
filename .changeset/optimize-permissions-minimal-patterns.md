---
"@zcaceres/skill-optimize-permissions": patch
---

Rewrite SKILL.md in plainer prose and restructure Step 5 to always propose the
minimally permissive pattern (literal command by default; wildcard only where an
argument is inherently variable, e.g. `gh pr view:*`).
