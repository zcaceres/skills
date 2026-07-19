---
"@zcaceres/skill-pr": patch
---

Fix invalid YAML in the `pr` SKILL.md frontmatter. The `description` contained a
`: ` (colon-space) inside an unquoted scalar (`ship a finished slice: ...`),
which strict YAML parsers reject with "mapping values are not allowed here". The
`skills` CLI silently dropped `pr` from discovery as a result, so `skills add -s pr`
listed every skill instead of installing, and `skills update pr` failed. Replaced
the colon with an em-dash so the frontmatter parses.
