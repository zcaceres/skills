---
"@zcaceres/skill-pr": minor
---

Always point reviewers at the parent branch in stacked PR notes. Every PR
body the skill writes for a stacked PR (base is another feature branch, not
the trunk) now carries a one-line **Stacked-on** pointer — the parent
branch name, linked to its PR when known — so human reviewers on GitHub see
the dependency and review order at a glance. The canonical format lives in
`checkpoint.md`; `update.md` adds it whenever it opens a PR against a
non-trunk base, and the `git stack`-driven paths (`checkpoint`, `update`,
`submit`) top up the auto-generated body when it doesn't already reference
the parent. A top-level rule in `SKILL.md` makes the convention apply to
every subcommand.
