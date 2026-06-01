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
npx skills add zcaceres/skills -s cli-agent-friendly-audit
npx skills add zcaceres/skills -s code-cleanup-analyzer
npx skills add zcaceres/skills -s commit-push-pr
npx skills add zcaceres/skills -s decompose
npx skills add zcaceres/skills -s find-docs
npx skills add zcaceres/skills -s git-reset-guard
npx skills add zcaceres/skills -s investigate-repo
npx skills add zcaceres/skills -s pr-size-nudge
npx skills add zcaceres/skills -s reflect-on-conversation
npx skills add zcaceres/skills -s rm-rf-guard
npx skills add zcaceres/skills -s storage-cleanup
npx skills add zcaceres/skills -s transcribe-youtube
npx skills add zcaceres/skills -s zoom
```

Add `-g` for global, or `-a <agent>` to target a specific agent (e.g. `-a claude-code`).
Hook skills (`git-reset-guard`, `pr-size-nudge`, `rm-rf-guard`) require additional
settings wiring — see each skill's README.

## Skills

| Skill | Description |
|---|---|
| `acid-trip` | Generate frontend designs from random rolls (Wikipedia × document type × aesthetic lineage). |
| `chaos-monkey` | Trace code paths to find bugs, race conditions, and edge cases. |
| `checkpoint` | Commit current diff as the next stacked PR against the parent branch. |
| `cleanup-computer` | Interactive file-by-file cleanup of Downloads/Desktop/Documents — delete, move, or keep. |
| `cli-agent-friendly-audit` | Audit a CLI tool against the agent-friendliness checklist for agent ergonomics. |
| `code-cleanup-analyzer` | Find dead code, duplicates, and circular deps via knip/jscpd/madge (run on demand with npx/bunx). |
| `commit-push-pr` | Commit, push, and open a PR (stack-aware). |
| `decompose` | Break stuck problems into tractable pieces using diagnostic lenses. |
| `find-docs` | Retrieve current docs, API references, and code examples for any library via the Context7 CLI. |
| `git-reset-guard` | **Hook.** Blocks destructive git commands (`reset --hard`, `push --force`, etc.); redirects to safer alternatives. |
| `investigate-repo` | Audit an unfamiliar repository for malicious patterns and supply-chain risk. |
| `pr-size-nudge` | **Hook.** Nudges toward `/checkpoint` when the uncommitted diff grows past size/file thresholds. |
| `reflect-on-conversation` | Structured retrospective on the current conversation — prompting, gaps, efficiency. |
| `rm-rf-guard` | **Hook.** Blocks `rm`, `shred`, `unlink`, `find -delete`, and sudo/xargs/subshell variants. |
| `storage-cleanup` | Find large files and directories that are safe to delete. |
| `transcribe-youtube` | Download and transcribe a YouTube video to a markdown file via yt-dlp + Whisper. |
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

