---
"@zcaceres/skill-pr": patch
---

Second review pass on the jj backend: update's new-bookmark path reassigns `$BRANCH` after `jj bookmark create` (the push and PR creation previously targeted the trunk, or an empty name), the stack handoff to submit moves after the commit so the conversation's changes land on the top slice first, and stale prose is corrected (SKILL.md submit row now says the jj backend needs no extra binary; setup manages three settings).
