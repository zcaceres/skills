# `/pr submit` — Publish the Whole Stack

Publish the local `gh stack`: push its branches, create or update each pull
request with the correct base branch, and link the pull requests into GitHub's
native stacked-pull-request object.

The Git backend requires GitHub's first-party extension:

```bash
gh extension install github/gh-stack
```

## Workflow

### 1. Verify and inspect the stack

```bash
gh stack --help >/dev/null || {
  echo 'Install the official extension: gh extension install github/gh-stack' >&2
  exit 1
}
git status --porcelain
gh stack view
```

Stop if the working tree is dirty. If the stack is not what the user expects,
stop rather than changing its membership or bases.

### 2. Submit

Resolve draft intent per [SKILL.md → Determine draft intent](../../SKILL.md).
Use `--auto` for agent/noninteractive operation. GitHub creates PRs as drafts
with `--auto` unless `--open` is given.

```bash
gh stack submit --auto          # draft intent
# or
gh stack submit --auto --open   # ready intent
```

For an interactive user request, omit `--auto` so GitHub's submit editor can
set each title, body, and draft state. Do not invent title prefixes: GitHub
natively displays stack order and relationships.

### 3. Report

Use `gh stack view` and report each PR URL, title, base branch, and whether it
is draft or ready. GitHub's linked stack is the source of truth; do not rewrite
PR titles to encode stack position.

## Important

- Do not retry blindly after a failed submit; surface partial state.
- Do not bypass hooks with `--no-verify`.
- Use `/pr update` for a single existing PR, and `/pr sync` after trunk moves.
