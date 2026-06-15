---
"@zcaceres/skill-pr": minor
---

Add `submit`, `log`, and `sync` subcommands to `/pr`.

- `/pr submit` — pure wrapper around `git stack submit`.
  Pushes every branch in the stack (force-with-lease) and
  creates/updates one GitHub PR per branch. Errors out with a clear
  "install `git stack`" message when the CLI isn't present rather
  than faking a multi-branch push with a `gh` loop.
- `/pr log` — read-only stack visualization. Uses
  `git stack log` when installed, otherwise walks
  `branch.<name>.stack-parent` git config entries and composes the
  view from `gh pr list`.
- `/pr sync [--no-push]` — fetch trunk and rebase every
  branch in the stack onto the updated tip. Uses `git stack sync`
  when installed, else walks the stack bottom-up rebasing each
  branch onto its parent. Refuses to run with a dirty tree; never
  auto-resolves conflicts.
