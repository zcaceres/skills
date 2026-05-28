# @zcaceres/skills

Open-source AI agent skills, organized as a Bun monorepo. Each skill conforms
to the [skills.sh / Agent Skills standard](https://github.com/vercel-labs/skills)
and is versioned/released independently.

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

**`SKILL.md` is the manifest.** Required frontmatter: `name` (must match the
folder name exactly) and `description` (what + when to activate). Optional
fields include `when_to_use`, `allowed-tools`, `context`, `effort`,
`disable-model-invocation`, `hooks`, `license`, `metadata`. See
[the spec reference](https://www.agensi.io/learn/skill-md-format-reference).

`package.json` exists only for the monorepo: workspace linking, per-skill
versioning via changesets, the release script. It is **not** part of the
published shape — `bun run build` emits a clean `dist/<name>/` directory
matching what skills.sh expects.

## Multi-agent variants

The skills.sh standard handles cross-agent compatibility through ignored
frontmatter, not parallel directories. Agent-specific extensions:

- Codex CLI reads `agents/openai.yaml` if present
- Claude Code reads `hooks`, `allowed-tools`, `context`, etc. from frontmatter
- Other agents fall back to plain `name` + `description` + markdown body

When a skill genuinely needs different content for a different agent, prefer
publishing it as a second skill (`<name>-codex/`) over an in-tree fork.

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

## Publishing

Each skill ships as a tarball on GitHub Releases (tag: `<skill>@<version>`)
and is registered with skills.sh. Local `bun run release <name>` and the GH
Action on tag push do the same thing — the Action is the source of truth.
