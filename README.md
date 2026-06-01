# @zcaceres/skills

Open-source AI agent skills, organized as a Bun monorepo. Each skill conforms
to the [skills.sh / Agent Skills standard](https://github.com/vercel-labs/skills)
and is versioned/released independently.

See `AGENTS.md` for cross-agent authoring conventions and the per-agent
capability matrix.

## Skills

| Skill | Description |
|---|---|
| `acid-trip` | Generate frontend designs from random rolls (Wikipedia × document type × aesthetic lineage). |
| `chaos-monkey` | Trace code paths to find bugs, race conditions, and edge cases. |
| `checkpoint` | Commit current diff as the next stacked PR against the parent branch. |
| `commit-push-pr` | Commit, push, and open a PR (stack-aware). |
| `decompose` | Break stuck problems into tractable pieces using diagnostic lenses. |
| `example-hello` | Minimal example demonstrating the monorepo layout. |
| `git-reset-guard` | **Hook.** Blocks destructive git commands (`reset --hard`, `push --force`, etc.); redirects to safer alternatives. |
| `investigate-repo` | Audit an unfamiliar repository for malicious patterns and supply-chain risk. |
| `pr-size-nudge` | **Hook.** Nudges toward `/checkpoint` when the uncommitted diff grows past size/file thresholds. |
| `reflect-on-conversation` | Structured retrospective on the current conversation — prompting, gaps, efficiency. |
| `rm-rf-guard` | **Hook.** Blocks `rm`, `shred`, `unlink`, `find -delete`, and sudo/xargs/subshell variants. |
| `storage-cleanup` | Find large files and directories that are safe to delete. |
| `zoom` | Shift abstraction level (`in` for internals, `out` for context). |

## Layout

```
skills/
├── skills/<name>/
│   ├── SKILL.md            # required — manifest (YAML frontmatter) + body
│   ├── scripts/            # executables the skill calls (optional)
│   ├── references/         # docs the skill reads (optional)
│   ├── assets/             # templates, samples (optional)
│   ├── agents/openai.yaml  # Codex CLI metadata (optional)
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
bun run cross-agent my-skill                 # validate cross-agent parity claims
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

## Cross-agent parity

Different agents read different optional frontmatter fields; the universal
core is `name` + `description` + the markdown body. Each skill declares its
parity contract in `package.json`:

```json
"crossAgent": {
  "supports": ["claude", "codex"],
  "requires": ["name", "description", "hooks"]
}
```

`bun run cross-agent` verifies that every required field is actually read by
every declared agent — catching the silent-drift failure where a skill ships
as "supports codex" but its load-bearing field (e.g. `hooks`) is dropped on
the floor at install time. See `AGENTS.md` for the per-agent capability
matrix.
