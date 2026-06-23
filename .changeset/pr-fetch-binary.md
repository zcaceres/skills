---
"@zcaceres/skill-pr": minor
---

Provision the nudge hook binary on install/setup so the file-copy
(`npx skills add`) experience actually works.

The hook execs a compiled `scripts/bin/pr-nudge-<os>-<arch>` binary.
Those are ~60 MB build artifacts — gitignored, never committed — so a
pure file-copy install shipped the source and `run.sh` but no binary,
leaving the hook a silent no-op. New `scripts/fetch-binary.sh` closes
the gap. It is idempotent and layered: skip if the binary is already
present → **download** the prebuilt binary for the host platform from
the skill's GitHub release (`gh`) → **build** with `bun` → otherwise
print manual steps. It is generic across every binary-bundling skill in
the repo — it derives the skill name from its own path and globs the
release asset by platform, so it needs no per-skill config. Overrides:
`SKILL_BINARY_REPO` (default `zcaceres/skills`), `SKILL_BINARY_TAG`
(default: latest `<skill>@*`).

`install.sh` and `/pr setup` now call it, so wiring the hook also leaves
it functional. The release pipeline (`.github/workflows/release.yml` and
`scripts/release-skill.ts`) now publishes the per-platform binaries as
individual, provenance-attested release assets for the download path to
fetch.
