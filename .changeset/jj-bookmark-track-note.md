---
"@zcaceres/skill-pr": patch
---

Document adopting an existing remote branch in the jj update and submit workflows: fetched bookmarks are never auto-tracked, so `jj git push -b` fails with `Non-tracking remote bookmark <name>@origin exists` until `jj bookmark track <name>@origin` imports it.
