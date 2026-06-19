# Zach's Awesome AI Skills

[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/zcaceres/skills/badge)](https://scorecard.dev/viewer/?uri=github.com/zcaceres/skills)

Open-source AI agent skills focused on engineering and personal productivity.

Skills conform to [skills.sh / Agent Skills standard](https://github.com/vercel-labs/skills)
and are versioned/released independently.

## Install

Skills install via the [`skills` CLI](https://github.com/vercel-labs/skills). The CLI auto-detects
your agent (Claude Code, Codex, Cursor, etc.) and drops files in the right place.

```bash
# Install every skill in this repo (project-local)
npx skills add zcaceres/skills

# Install globally (~/.claude/skills/ for Claude Code)
npx skills add zcaceres/skills -g

# Browse without installing
npx skills add zcaceres/skills --list
```

Install one or more specific skills with `-s <name>`:

```bash
npx skills add zcaceres/skills -s acid-trip
npx skills add zcaceres/skills -s quality-chaos-monkey
npx skills add zcaceres/skills -s cleanup-computer
npx skills add zcaceres/skills -s clean-ai-slop
npx skills add zcaceres/skills -s quality-cli-agent-friendly-audit
npx skills add zcaceres/skills -s quality-dead-code-analyzer
npx skills add zcaceres/skills -s quality-perf-review
npx skills add zcaceres/skills -s copywriting
npx skills add zcaceres/skills -s decompose
npx skills add zcaceres/skills -s find-docs
npx skills add zcaceres/skills -s gemini-deep-research
npx skills add zcaceres/skills -s gh-project
npx skills add zcaceres/skills -s investigate-repo
npx skills add zcaceres/skills -s optimize-permissions
npx skills add zcaceres/skills -s pr
npx skills add zcaceres/skills -s quality-project-health
npx skills add zcaceres/skills -s record-gif
npx skills add zcaceres/skills -s reflect-on-conversation
npx skills add zcaceres/skills -s review-code
npx skills add zcaceres/skills -s safety-dotenv-guard
npx skills add zcaceres/skills -s safety-git-reset-guard
npx skills add zcaceres/skills -s safety-op-creds
npx skills add zcaceres/skills -s safety-rm-rf-guard
npx skills add zcaceres/skills -s storage-cleanup
npx skills add zcaceres/skills -s transcribe-youtube
npx skills add zcaceres/skills -s trip-planner
npx skills add zcaceres/skills -s zoom
```

Add `-g` for global, or `-a <agent>` to target a specific agent (e.g. `-a claude-code`).

**Hook skills.** `safety-dotenv-guard`, `safety-git-reset-guard`,
`safety-op-creds`, `safety-rm-rf-guard`, and `pr` each ship a
`scripts/install.sh` that idempotently wires
the hook into `~/.claude/settings.json` (with a timestamped backup).
Two-step install:

```sh
npx skills add zcaceres/skills -s <hook-skill>
~/.claude/skills/<hook-skill>/scripts/install.sh
```

Why two steps: the `skills` CLI is a pure file copier and runs no
publisher code on install. The SKILL.md frontmatter `hooks:` block only
fires while the skill is active in context — not always-on. `install.sh`
gets the hook onto every matching tool call. Requires `jq`. See each
skill's `SKILL.md` for `--project` / `--target` flags and manual wiring
as an alternative. The script self-locates, so the same command works
whether the skill was installed at user scope or project scope.

## Install as a Claude Code plugin

The prefix-grouped skills are also bundled as [Claude Code plugins](https://code.claude.com/docs/en/plugins)
in a marketplace, so a whole group installs at once and its skills are
namespaced under the group name:

```shell
/plugin marketplace add zcaceres/skills
/plugin install security@zcaceres-skills   # then /security:openssf, /security:gitleaks, …
/plugin install quality@zcaceres-skills    # /quality:chaos-monkey, /quality:perf-review, …
```

Same skills as `npx skills add`, grouped and namespaced. The plugin tree under
`plugins/` and the catalog at `.claude-plugin/marketplace.json` are **generated**
from `skills/` — see [Workflow](#workflow). The `safety-*` guards aren't bundled
yet: their hooks run a compiled binary that a file-copy marketplace can't ship
(see the deferral note in `scripts/build-plugins.ts`).

## Skills

| Skill | Description |
|---|---|
| `acid-trip` | Generate frontend designs from random rolls (Wikipedia × document type × aesthetic lineage). |
| `quality-chaos-monkey` | Trace code paths to find bugs, race conditions, and edge cases. |
| `cleanup-computer` | Interactive file-by-file cleanup of Downloads/Desktop/Documents — delete, move, or keep. |
| `clean-ai-slop` | Diff the current branch against `main` and strip AI-generated slop — superfluous comments, defensive `try/catch`, `any`-casts, style inconsistent with the file. |
| `quality-cli-agent-friendly-audit` | Audit a CLI tool against the agent-friendliness checklist for agent ergonomics. |
| `quality-dead-code-analyzer` | Find dead code, duplicates, and circular deps via knip/jscpd/madge (run on demand with npx/bunx). |
| `quality-perf-review` | Analyze a full-stack web app for evidence-based performance bottlenecks, interactively. |
| `copywriting` | Refine and edit text into clear, concise copy — Anglo-Saxon swaps, banned AI-tells, worked examples. |
| `decompose` | Break stuck problems into tractable pieces using diagnostic lenses. |
| `quality-docs-update` | Audit project docs against the codebase via parallel Explore agents, produce a per-file revision plan, and apply approved fixes. |
| `find-docs` | Retrieve current docs, API references, and code examples for any library via the Context7 CLI. |
| `gemini-deep-research` | Run Google Gemini Deep Research reports — submit a topic, background-poll, save the markdown report. Needs `GEMINI_API_KEY`. |
| `gh-project` | Manage a repo's GitHub Projects kanban board as one skill: bootstrap (setup), pick the next card (next), create/edit/decompose/delete cards, audit board vs codebase (review), and batch create/update/delete many cards at once. |
| `investigate-repo` | Audit an unfamiliar repository for malicious patterns and supply-chain risk. |
| `optimize-permissions` | Scan recent transcripts for safe commands the user keeps approving, preview the proposals, and write them to the right agent config (Claude Code, Codex, Cursor). |
| `pr` | **Hook + slash command.** Commit work and open PRs with `/pr`. Normal mode (default) commits your conversation changes, pushes, and opens a single PR against the trunk; stacked mode turns `/pr` into a stacked-PR workflow (`checkpoint`, `submit`, `sync`, bottom-up `merge`). Toggle with `/pr setup`. Also bundles the PostToolUse diff-size nudge. |
| `quality-project-health` | **Slash command.** Assess the current repo and work tracker, then rate overall project health from 0-10. |
| `record-gif` | Record animated GIFs of web page animations via Playwright frame capture + ffmpeg palette encoding. |
| `reflect-on-conversation` | Structured retrospective on the current conversation — prompting, gaps, efficiency. |
| `review-code` | **Slash command.** One skill for the full code-review pipeline: `/review-code` reviews the branch diff and reports findings (default), `repro` reproduces each finding to filter false positives, `fix` plans fixes, gates on approval, then applies and verifies. Supersedes `review-code-repro` and `review-code-fix`. |
| `safety-dotenv-guard` | **Hook.** Blocks `Read`/`Bash`/`Grep`/`Glob` tool calls that touch `.env` files; allows `.env.example`-style templates. |
| `safety-git-reset-guard` | **Hook.** Blocks destructive git commands (`reset --hard`, `push --force`, etc.); redirects to safer alternatives. |
| `safety-op-creds` | **Hook + wrapper.** Use 1Password-stored credentials via `op` CLI + bash process substitution / `op run`; blocks bare `op read` and other secret-printing op subcommands. |
| `safety-rm-rf-guard` | **Hook.** Blocks `rm`, `shred`, `unlink`, `find -delete`, and sudo/xargs/subshell variants. |
| `storage-cleanup` | Find large files and directories that are safe to delete. |
| `transcribe-youtube` | Download and transcribe a YouTube video to a markdown file via yt-dlp + Whisper. |
| `trip-planner` | Generate a packing list from a destination weather forecast (wttr.in helper bundled). |
| `zoom` | Shift abstraction level (`in` for internals, `out` for context). |

## Layout

```
skills/
├── skills/<name>/
│   ├── SKILL.md            # required — manifest (YAML frontmatter) + body
│   ├── scripts/            # executables the skill calls (optional)
│   ├── references/         # docs the skill reads (optional)
│   ├── assets/             # templates, samples (optional)
│   ├── package.json        # monorepo plumbing: workspace, version, scripts
│   └── README.md
├── _template/              # scaffold copied by `bun run new`
├── scripts/                # new-skill, build-skill, build-plugins, release-skill, check
├── plugins/<group>/        # GENERATED Claude Code plugins (bun run build:plugins)
│   ├── .claude-plugin/plugin.json
│   ├── skills/<name>/SKILL.md
│   └── hooks/hooks.json    # only if a group's skills declare `hooks:`
├── .claude-plugin/
│   └── marketplace.json    # GENERATED catalog of the plugins above
└── .changeset/             # per-skill versioning
```

## Workflow

```bash
bun install                                  # link workspaces

bun run new my-skill "One-line description"  # scaffold from _template
bun run check                                # validate all skills
bun run build my-skill                       # build to skills/my-skill/dist/my-skill
bun run build:plugins                        # regenerate plugins/ + marketplace.json from skills/
bun run changeset                            # record a version bump
bun run version                              # apply changesets to package.json
bun run release my-skill                     # tag + GH release (CI mirrors)
```

`plugins/` and `.claude-plugin/marketplace.json` are generated **and committed**
(a git-hosted marketplace must contain the plugin files). Edit skills under
`skills/`, never the copies under `plugins/`; re-run `bun run build:plugins` and
commit — CI fails if they drift. Skills are grouped into plugins by name prefix
(`security-*` → `security`, etc.); the generator strips the prefix, repoints
script/hook paths at `${CLAUDE_PLUGIN_ROOT}`, and lifts `hooks:` frontmatter into
the plugin's `hooks/hooks.json`. To keep skills.sh-only prose (e.g. an
`install.sh` walkthrough) out of the plugin copy, wrap it in
`<!-- plugin:omit -->…<!-- /plugin:omit -->` in the source `SKILL.md` — markdown
ignores the comments; the generator drops the region.

Run once per clone to activate the gitleaks pre-commit hook (blocks commits
containing secrets — requires `brew install gitleaks`):

```bash
git config core.hooksPath .githooks
```

## Bundled tools

Skills with binaries or external code put them in `scripts/` (per the
spec). If they're fetched from elsewhere — a GitHub release, a build of a
sibling repo — define a `fetch-tools` npm script in the skill's
`package.json`; the build pipeline runs it before packaging. Fetched
binaries land in `scripts/bin/` and are gitignored.
