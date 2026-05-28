# @zachcaceres/skills

Open-source AI agent skills, organized as a Bun monorepo. Each skill lives
under `skills/<name>/` as its own workspace package, versioned and released
independently.

## Layout

```
skills/
├── skills/<name>/
│   ├── package.json        # name, version, skill metadata, agents supported
│   ├── claude/             # Claude Code variant (e.g. SKILL.md, hooks, etc.)
│   ├── antigravity/        # Antigravity variant (only when supported)
│   ├── codex/              # Codex variant (only when supported)
│   ├── shared/             # tools, snippets, binaries shared across variants
│   └── README.md
├── _template/              # scaffold copied by `bun run new`
├── scripts/                # new-skill, build-skill, release-skill, check
└── .changeset/             # per-skill versioning
```

Every agent gets its own folder. The skill's `package.json` declares which
agents it supports and the entry file for each:

```json
"skill": {
  "id": "example-hello",
  "agents": ["claude", "antigravity"],
  "entry": {
    "claude": "claude/SKILL.md",
    "antigravity": "antigravity/SKILL.md"
  }
}
```

Common logic — a compiled binary, a prompt fragment, a helper script — lives
in `shared/`. Variants reference it directly (e.g. `../shared/intro.md`) or
inline it at build time with `{{ include "shared/intro.md" }}`.

## Workflow

```bash
bun install                                 # link workspaces

bun run new my-skill "One-line description" # scaffold from _template
bun run check                               # lint all skills
bun run build my-skill                      # build to skills/my-skill/dist
bun run changeset                           # record a version bump
bun run version                             # apply changesets
bun run release my-skill                    # tag + GH release (CI mirrors)
```

## Bundled tools

Skills with binaries or external code define `skill.tools` in their
`package.json` and a `fetch-tools` script that lands artifacts in
`shared/bin/`. The build pipeline runs it before packaging.

## Publishing

Each skill ships as a tarball on GitHub Releases (tag: `<skill>@<version>`)
and is registered with skills.sh. The workflow is mirrored: local
`bun run release` works for fast iteration; the GH Action on tag push is the
source of truth.
