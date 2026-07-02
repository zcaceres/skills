---
"@zcaceres/skill-pr": minor
---

Add a `--draft` flag to `/pr submit`. It passes `--draft` through to `git stack submit`, so every PR the stack publishes is created as a draft. Existing PRs are left untouched.
