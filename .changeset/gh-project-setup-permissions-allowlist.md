---
"@zcaceres/skill-gh-project-setup": minor
---

gh-project-setup now offers to write a Claude Code permission allowlist for
the safe `gh` command surface (read-only queries, card creation, status
moves, and the board helper script) so sibling `/gh-project-*` skills run
without per-call permission prompts. The user picks committed
(`.claude/settings.json`) vs local (`.claude/settings.local.json`) and
approves a diff before anything is written; declining still leaves setup
successful.
