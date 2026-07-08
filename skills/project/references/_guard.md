# Backend guard — run before every subcommand except `setup`

Every `/project` subcommand except `setup` starts here. The guard locates the
project config, determines which backend is active, asserts that backend's
prerequisites, and exports the variables the subcommand body uses. It is the one
place that knows the backend — the workflow bodies stay backend-agnostic and
speak a canonical status vocabulary (see the bottom of this file).

## Step 1 — Locate the config

```bash
if [ -f .project/config.json ]; then
  CFG=.project/config.json
elif [ -f .github/gh-project.json ]; then
  # Pre-rename config. Don't use it in place — route to setup, which re-reads the
  # existing project and rewrites it to .project/config.json with the current schema.
  echo "Found a legacy .github/gh-project.json but no .project/config.json."
  echo "Run /project setup to migrate it (your existing project is preserved)."
  exit 1
else
  echo "WARNING: No project configuration found at .project/config.json."
  echo "Run /project setup first to configure a backend and board."
  exit 1
fi
```

If either branch printed a message, **stop** — do not guess a backend or IDs.

## Step 2 — Determine the backend

```bash
BACKEND=$(jq -r '.backend // "github"' "$CFG")
```

A config with no `backend` field is treated as **github** (schema versions
before the multi-backend split only described GitHub Projects).

## Step 3 — Assert the backend's prerequisites and export its variables

### github

Board access goes through the helper script, which asserts `fetched == totalCount`
and fails loudly on truncation. See [backends/github.md](backends/github.md) for
the full verb → `gh` mapping.

```bash
HELPER=.project/scripts/board.sh
if [ ! -x "$HELPER" ]; then
  echo "WARNING: Missing or non-executable $HELPER — run /project setup to reinstall it."
  exit 1
fi

REPO_OWNER=$(jq -r .repoOwner "$CFG")
REPO=$(jq -r .repo "$CFG")
PROJECT_OWNER=$(jq -r .projectOwner "$CFG")
PROJECT_NUMBER=$(jq -r .projectNumber "$CFG")
```

The subcommand body below assumes these are set. Deeper GitHub-only IDs
(`projectId`, `statusField.id`, option IDs) are read from `"$CFG"` at the point
of use.

### linear

The backend is the official Linear MCP. There is no board script. See
[backends/linear.md](backends/linear.md) for the full verb → MCP mapping.

1. **Confirm the MCP is reachable.** Call `list_teams`. If the tool isn't
   available, stop and tell the user to connect the Linear MCP, then re-invoke.
2. **Read the config** for the fields the body uses:
   - `TEAM_ID` = `.teamId`, `TEAM_KEY` = `.teamKey`
   - `PROJECT_ID` = `.projectId` (may be null)
   - `statusMap` (canonical → workflow-state UUID) and `statusNames` (display labels)
3. **Board reads obey the Completeness rule** (see
   [backends/linear.md](backends/linear.md#completeness-rule-read-before-any-list-verb)):
   page `list_issues` until exhausted; if you can't, say the board is truncated
   and never rank or audit a partial board. This is the model-invoked stand-in for
   github's fail-loud `board.sh`.

## Canonical status vocabulary

Workflow bodies never hardcode a native status name. They name a **canonical**
status — one of `backlog`, `todo`, `in_progress`, `done`, `cancelled` — and the
active backend adapter translates it to the native value before the tracker call.

For github, the translation lives in the config's `statusMap` (canonical →
native option name) and `board.sh` resolves that name to an option id via
`statusField.options`. A canonical status mapped to `null` (default GitHub boards
have no Backlog/Cancelled column) falls back: `backlog` → `todo`;
`cancelled` → leave the status and note it in the body. See
[backends/github.md](backends/github.md#status-translation).
