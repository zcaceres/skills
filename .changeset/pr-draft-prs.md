---
"@zcaceres/skill-pr": minor
---

Add draft-PR support. Any PR `/pr` creates can be opened as a draft, two
ways that mirror the normal/stacked mode toggle:

- **Per invocation** — `--draft` (or `-d`) on any `/pr` command opens the
  new PR as a draft; `--ready`/`--no-draft` forces a ready PR for that
  run. The dispatcher strips these flags wherever they appear, so they
  never consume the subcommand slot (`/pr --draft`, `/pr update --draft`,
  `/pr checkpoint -d "wip"` all work).
- **By default** — `git config pr.draft true` (set via `/pr setup`, global
  by default) opens every new PR as a draft. Follows the same
  local-beats-global precedence as `pr.mode`; a per-invocation flag always
  overrides it.

Drafting applies at PR creation. The `gh` create paths pass `--draft`
natively. `git stack submit` has no draft flag, so the stacked git-stack
path marks the just-created PRs draft afterward via `gh pr ready --undo`,
leaving already-open PRs untouched. An open PR's draft state is only
flipped when an explicit `--draft`/`--ready` flag is passed that run — the
configured default never silently re-drafts an open PR. `/pr setup` now
shows and edits both `pr.mode` and `pr.draft`.
