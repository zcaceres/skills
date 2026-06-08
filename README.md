# @zcaceres/skills

Open-source AI agent skills.

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
npx skills add zcaceres/skills -s chaos-monkey
npx skills add zcaceres/skills -s checkpoint
npx skills add zcaceres/skills -s cleanup-computer
npx skills add zcaceres/skills -s clean-ai-slop
npx skills add zcaceres/skills -s cli-agent-friendly-audit
npx skills add zcaceres/skills -s code-cleanup-analyzer
npx skills add zcaceres/skills -s commit-push-pr
npx skills add zcaceres/skills -s copywriting
npx skills add zcaceres/skills -s decompose
npx skills add zcaceres/skills -s find-docs
npx skills add zcaceres/skills -s gemini-deep-research
npx skills add zcaceres/skills -s investigate-repo
npx skills add zcaceres/skills -s perf-review
npx skills add zcaceres/skills -s pr-size-nudge
npx skills add zcaceres/skills -s record-gif
npx skills add zcaceres/skills -s reflect-on-conversation
npx skills add zcaceres/skills -s review-code
npx skills add zcaceres/skills -s review-code-reproduce
npx skills add zcaceres/skills -s review-code-fix
npx skills add zcaceres/skills -s safety-dotenv-guard
npx skills add zcaceres/skills -s safety-git-reset-guard
npx skills add zcaceres/skills -s safety-op-creds
npx skills add zcaceres/skills -s safety-rm-rf-guard
npx skills add zcaceres/skills -s stacked-pr
npx skills add zcaceres/skills -s storage-cleanup
npx skills add zcaceres/skills -s transcribe-youtube
npx skills add zcaceres/skills -s trip-planner
npx skills add zcaceres/skills -s zoom
```

Add `-g` for global, or `-a <agent>` to target a specific agent (e.g. `-a claude-code`).

**Hook skills.** `pr-size-nudge`, `safety-dotenv-guard`,
`safety-git-reset-guard`, `safety-op-creds`, `safety-rm-rf-guard`, and
`stacked-pr` each ship a `scripts/install.sh` that idempotently wires
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

## Skills

| Skill | Description |
|---|---|
| `acid-trip` | Generate frontend designs from random rolls (Wikipedia × document type × aesthetic lineage). |
| `chaos-monkey` | Trace code paths to find bugs, race conditions, and edge cases. |
| `checkpoint` | Commit current diff as the next stacked PR against the parent branch. |
| `cleanup-computer` | Interactive file-by-file cleanup of Downloads/Desktop/Documents — delete, move, or keep. |
| `clean-ai-slop` | Diff the current branch against `main` and strip AI-generated slop — superfluous comments, defensive `try/catch`, `any`-casts, style inconsistent with the file. |
| `cli-agent-friendly-audit` | Audit a CLI tool against the agent-friendliness checklist for agent ergonomics. |
| `code-cleanup-analyzer` | Find dead code, duplicates, and circular deps via knip/jscpd/madge (run on demand with npx/bunx). |
| `commit-push-pr` | Commit, push, and open a PR (stack-aware). |
| `copywriting` | Refine and edit text into clear, concise copy — Anglo-Saxon swaps, banned AI-tells, worked examples. |
| `decompose` | Break stuck problems into tractable pieces using diagnostic lenses. |
| `find-docs` | Retrieve current docs, API references, and code examples for any library via the Context7 CLI. |
| `gemini-deep-research` | Run Google Gemini Deep Research reports — submit a topic, background-poll, save the markdown report. Needs `GEMINI_API_KEY`. |
| `investigate-repo` | Audit an unfamiliar repository for malicious patterns and supply-chain risk. |
| `perf-review` | Analyze a full-stack web app for evidence-based performance bottlenecks, interactively. |
| `pr-size-nudge` | **Hook.** Nudges toward `/checkpoint` when the uncommitted diff grows past size/file thresholds. |
| `record-gif` | Record animated GIFs of web page animations via Playwright frame capture + ffmpeg palette encoding. |
| `reflect-on-conversation` | Structured retrospective on the current conversation — prompting, gaps, efficiency. |
| `review-code` | Review the current branch diff and report bugs as structured inline-style findings. |
| `review-code-reproduce` | Second step of the code-review trio: reproduce and validate each finding to filter false positives before any fix is planned. |
| `review-code-fix` | Third step of the code-review trio: plan fixes for validated findings, stop for user approval, then apply and verify. |
| `safety-dotenv-guard` | **Hook.** Blocks `Read`/`Bash`/`Grep`/`Glob` tool calls that touch `.env` files; allows `.env.example`-style templates. |
| `safety-git-reset-guard` | **Hook.** Blocks destructive git commands (`reset --hard`, `push --force`, etc.); redirects to safer alternatives. |
| `safety-op-creds` | **Hook + wrapper.** Use 1Password-stored credentials via `op` CLI + bash process substitution / `op run`; blocks bare `op read` and other secret-printing op subcommands. |
| `safety-rm-rf-guard` | **Hook.** Blocks `rm`, `shred`, `unlink`, `find -delete`, and sudo/xargs/subshell variants. |
| `stacked-pr` | **Hook + slash command.** One skill for the full stacked-PR workflow: `/stacked-pr checkpoint` ships the next slice, `update` updates the current PR, `submit` pushes the whole stack, `log` visualizes it, `sync` rebases onto trunk, `merge` lands bottom-up. Also bundles the PostToolUse nudge. Supersedes `checkpoint`, `commit-push-pr`, and `pr-size-nudge`. |
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
├── scripts/                # new-skill, build-skill, release-skill, check
└── .changeset/             # per-skill versioning
```

## Workflow

```bash
bun install                                  # link workspaces

bun run new my-skill "One-line description"  # scaffold from _template
bun run check                                # validate all skills
bun run build my-skill                       # build to skills/my-skill/dist/my-skill
bun run changeset                            # record a version bump
bun run version                              # apply changesets to package.json
bun run release my-skill                     # tag + GH release (CI mirrors)
```

## Bundled tools

Skills with binaries or external code put them in `scripts/` (per the
spec). If they're fetched from elsewhere — a GitHub release, a build of a
sibling repo — define a `fetch-tools` npm script in the skill's
`package.json`; the build pipeline runs it before packaging. Fetched
binaries land in `scripts/bin/` and are gitignored.

