# AGENTS.md

> **Sync with `CLAUDE.md`.** This file's body is kept in sync with `CLAUDE.md`
> so other agents (Codex, Cursor, etc.) get the same context. Only the title
> and this self-reference line differ between the two; when you edit one,
> mirror the change to the other in the same commit.

## Project tracker

Work for this repo is tracked on the GitHub Project board at https://github.com/users/zcaceres/projects/4.

The project's configuration — number, owner, project node ID, status field ID,
and status option IDs — is stored in `.github/gh-project.json`. Agents managing
this board should read that file rather than hard-coding IDs (IDs change if the
project is recreated).

Board access goes through `.github/scripts/gh-project-board.sh`:

- `list [--query <q>] [--include-body]` — compact JSONL of all items
- `find <PVTI_… | issue# | title-substring>` — resolve a selector
- `find-many <selector> [<selector> …]` — resolve many selectors in one fetch
- `get <item-id>` — full row with body
- `set-status <item-id> <status-name>` — move card between columns

The helper asserts completeness against `totalCount` and exits non-zero on
truncation, so an agent that "doesn't see" a card will fail loudly instead
of silently missing it.

Card workflow (all via the `/gh-project` skill):
- Create:    `/gh-project new-task` (creates a linked GitHub issue by default)
- Pick:      `/gh-project next` (shows top Todo cards, moves pick to In Progress, dumps context)
- Edit:      `/gh-project update [id|number|title]`
- Decompose: `/gh-project decompose [id|number|title]` (split a big card into linked subtasks)
- Audit:     `/gh-project review` (board vs codebase)
- Delete:    `/gh-project delete [id|number|title]`
- Batch:     `/gh-project batch <create|update|delete>` (same op across many cards at once)

When an item is finished, **move it to the `Done` column — do not delete it.**
Deleted draft items lose their history.

## Plugin marketplace (generated)

`plugins/` and `.claude-plugin/marketplace.json` package prefix-grouped skills
(currently `security-*` and `quality-*`) as a Claude Code plugin marketplace, so
a group installs at once and its skills are namespaced (`/security:openssf`, …).
These are **generated from `skills/`** by `bun run build:plugins` — never
hand-edit the copies under `plugins/`. Edit the originals in
`skills/<group>-<name>/`, re-run the build, and commit; CI fails if the
generated tree drifts. See `scripts/build-plugins.ts` for the transforms
(prefix-stripping, `${CLAUDE_PLUGIN_ROOT}` path rewrites, `hooks:` lifting, and
`<!-- plugin:omit -->` regions). `safety-*` is deferred — its guards run a
compiled binary a file-copy marketplace can't ship.
