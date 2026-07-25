---
"@zcaceres/skill-pr": patch
---

jj submit now self-heals PR bases: for each existing PR whose base disagrees with the stack's current shape it runs `gh pr edit --base`, verifies the retarget, and lists every base move in the report — matching `git stack submit`'s behavior on the git path. Draft state of existing PRs stays untouched.
