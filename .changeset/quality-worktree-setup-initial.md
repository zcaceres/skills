---
"@zcaceres/skill-quality-worktree-setup": minor
---

New skill `quality-worktree-setup` — makes a repo auto-configure itself for
`claude --worktree`, so a fresh worktree comes up ready instead of missing every
gitignored file and skipping installs. Rather than dropping in a template, it
interviews the codebase across four buckets — gitignored-but-needed files,
install/build steps, per-worktree port collisions, and shared caches — and has
the user confirm the spec before generating anything. Three slash-only modes:
`setup` (bootstrap), `update` (re-discover and patch the managed config when the
repo changes), and `check` (verify only). Defaults to the safe, future-proof
`SessionStart` hook and escalates to a `WorktreeCreate` hook only when setup must
finish before the TUI or the repo is non-git. Generated files carry managed
`--- generated ---` regions so `update` rewrites only its own output, and ship a
`references/approaches.md` covering the verified hook contracts, the
SessionStart-vs-WorktreeCreate tradeoff, port/symlink snippets, and the
correctness rules (worktree-only path guard, run-once marker, stdout discipline).
