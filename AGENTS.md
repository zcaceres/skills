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

## Versioning & releases

Every skill is its own versioned package (`skills/<name>/package.json`) and ships
through [Changesets](https://github.com/changesets/changesets). The README
"Workflow" section is the command reference; the rules below are what's easy to
get wrong.

**Every change to a skill needs a changeset.** After editing anything under
`skills/<name>/`, run `bun run changeset`, then pick the skill(s) and bump level
(patch/minor/major). CI enforces this: the `changeset` job fails any PR that
touches `skills/**` without one (`changeset status --since=origin/main`). Label a
PR `skip-changeset` for a deliberate exception. Never hand-edit a skill's
`version` or `CHANGELOG.md` — `bun run version` generates both. Root/infra
changes (this file, `scripts/`, `.github/`) are not packages and need no
changeset.

**Cutting a release** (maintainer, occasional):

1. `bunx @changesets/cli status` first. `bun run version` consumes *all* pending
   changesets at once (all-or-nothing) and bumps every affected skill — it's a
   coordinated event, not per-skill. Review the blast radius before running it.
2. Run `bun run version`. `main` is branch-protected, so land the generated
   "Version Packages" diff via a PR built from a throwaway
   `git worktree add <dir> origin/main` (keeps the active branch untouched), and
   label it `skip-changeset` (it changes skills but intentionally carries no
   changeset). Re-run `bun run build:plugins` and commit if `plugins/` drifts.
3. After merge, publish a skill by pushing its `<skill>@<version>` tag.
   `release.yml` builds it, attests provenance, and creates the GitHub Release
   (tarball + per-platform binaries for binary-bundling skills). Pushing a tag is
   the irreversible publish step. Push **at most 3 tags per `git push`** — GitHub
   creates no events (so no releases fire) when more than three tags arrive in a
   single push, so batch a multi-skill release.

**Binary-bundling skills** (`pr`, `safety-*`, `stacked-pr-gemini`) compile a
~60 MB `scripts/bin/<name>-<os>-<arch>` binary that is gitignored and never
committed. Releases publish those as individual assets; installs provision them
via `scripts/fetch-binary.sh` (download from the GH release, else build with bun)
— `/pr setup` and the skills' `install.sh` run it.
