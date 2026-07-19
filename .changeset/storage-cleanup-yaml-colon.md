---
"@zcaceres/skill-storage-cleanup": patch
---

Fix invalid YAML in the `storage-cleanup` SKILL.md frontmatter. The `description`
contained a `: ` (colon-space) inside an unquoted scalar (`safe to delete: ...`),
which strict YAML parsers reject, so the `skills` CLI silently dropped the skill
from discovery. Replaced the colon with an em-dash.
