---
"@zcaceres/skill-laconic": patch
---

Include the `clear` SessionStart source in the hook matcher. Previously the
matcher was `startup|resume|compact`, so running `/clear` did not re-inject the
register and the laconic voice silently dropped until the next startup, resume,
or compaction. The matcher is now `startup|resume|clear|compact` in both the
`SKILL.md` frontmatter and `install.sh`.
