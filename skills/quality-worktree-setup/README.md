# quality-worktree-setup

Make a repo set itself up automatically whenever you start `claude --worktree`.
A fresh worktree is missing every gitignored file (`.env`, local config, certs)
and has run no install/build step — so it often can't run. This skill
**interviews the codebase** for what a fresh worktree actually needs, then
generates, wires, and smoke-tests the right `.worktreeinclude` + hook.

It is not a drop-in template. The value is the discovery and the
human-in-the-loop confirmation of what belongs in *this* repo.

**Usage:** `/quality-worktree-setup [setup | update | check]`

- `setup` — first-time bootstrap: discover → confirm → generate → verify.
- `update` — re-discover after the repo changes and patch the managed config.
- `check` — verify the current config (optionally a live smoke test); no writes.

Bare `/quality-worktree-setup` auto-picks: **update** if a managed config
already exists, **setup** otherwise.

## What it discovers

- **Gitignored-but-needed files** — `.env*`, certs, service-account JSONs,
  cross-referenced against `.env.example`.
- **Install / build steps** — reuses an existing `setup`/`bootstrap` target, or
  infers per ecosystem (uv, poetry, bun/pnpm/npm/yarn, cargo, go, bundler, …),
  including monorepo sub-packages.
- **Per-worktree ports** — deterministic, branch-derived ports so parallel
  worktrees don't collide.
- **Shared caches** — opt-in symlinks for heavy regenerable trees, with the
  shared-mutation tradeoff spelled out.

It defaults to the safe, future-proof `SessionStart` hook and escalates to a
`WorktreeCreate` hook only when setup must finish before the TUI or the repo
isn't git. See `references/approaches.md` for the full tradeoff.

## Layout

- `SKILL.md` — manifest + instructions (skills.sh standard)
- `references/approaches.md` — verified hook contracts, decision logic, snippets
- `assets/` — hook templates (`worktree-init.sh`, `worktree-create.sh`),
  `settings.snippet.json`, `worktreeinclude.example`

## Install

```
npx skills add zcaceres/skills -s quality-worktree-setup
```

Add `-g` for global install, or `-a <agent>` to target a specific agent.
