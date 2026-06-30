---
"@zcaceres/skill-audit-aws-costs": patch
---

Make `audit-aws-costs` invocable only via the `/audit-aws-costs` slash command,
not ambiently. Adds `disable-model-invocation: true` to the skill frontmatter so
the model never auto-activates it, and updates the description and "When to Use"
section to reflect explicit invocation.
