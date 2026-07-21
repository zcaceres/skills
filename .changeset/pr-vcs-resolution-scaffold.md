---
"@zcaceres/skill-pr": minor
---

pr: add a VCS-selection axis (`pr.vcs` = git | jj). SKILL.md now resolves the VCS structurally before mode/draft — a git repo drives git, a native jj repo drives jj, and a colocated repo defaults to git unless `pr.vcs jj` opts in. The resolved VCS selects the config store (`git config` vs `jj config`) and which `references/<vcs>/` recipes run. `/pr setup` gains a `pr.vcs` toggle and reports detected-vs-configured VCS. Fully backwards-compatible: existing git repos are unchanged. jj recipes land in a follow-up.
