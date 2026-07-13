---
"@zcaceres/skill-pr": minor
---

Add a per-invocation draft flag (`--draft`/`-d`, with `--ready`/`--no-draft` to force ready) on every `/pr` verb, plus a persistent `pr.draft` default managed by `/pr setup`. Builds on the native `git stack submit --draft` support: draft intent (explicit flag or the configured default) decides whether created PRs open as drafts. The default never re-drafts an already-open PR; only an explicit flag flips one.
