# `/pr log` — Visualize the Stack

Read-only. Use GitHub's first-party stack metadata and display the current
local stack, including its branches, pull requests, and status.

```bash
gh stack --help >/dev/null || {
  echo 'Install the official extension: gh extension install github/gh-stack' >&2
  exit 1
}
gh stack view
```

For structured output suitable for additional reporting, use:

```bash
gh stack view --json
```

Pass the result through to the user. Do not infer a stack from branch ancestry
or add title markers. For a remote stack not tracked locally, use
`gh stack checkout <stack-number-or-pr-number>` before running this command.

## Important

- This subcommand is read-only: do not rebase, push, or open PRs.
- Surface GitHub authentication or stack errors verbatim.
- Direct users who want changes to `/pr sync`, `/pr checkpoint`, or `/pr merge`.
