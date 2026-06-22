#!/usr/bin/env bash
# managed by quality-worktree-setup — re-run `/quality-worktree-setup update` to regenerate.
#
# SessionStart hook: prepares a fresh Claude Code worktree (secrets, ports,
# shared caches, installs) the first time a session starts inside it.
#
# Contract: SessionStart has NO stdout contract — everything here logs to
# stderr. Output interleaves with Claude's startup banner; that's expected.
set -euo pipefail

input=$(cat)
cwd=$(printf '%s' "$input" | jq -r '.cwd')

# Act only inside a worktree that `claude --worktree` created — these live under
# .claude/worktrees/. This is correct whether the session was launched from the
# primary checkout OR from another linked worktree (e.g. a Conductor workspace,
# which is itself a linked worktree, so a `git-dir != git-common-dir` test alone
# would wrongly fire on the launch dir).
case "$cwd" in
  */.claude/worktrees/*) : ;;   # a claude --worktree worktree → proceed
  *) exit 0 ;;                   # primary checkout / unrelated dir → no-op
esac

# Run setup once per worktree, not on every resume/clear/compact.
marker="$cwd/.claude-worktree-ready"
[ -f "$marker" ] && exit 0

# Everything below logs to stderr.
{
  cd "$cwd"
  echo "[worktree-setup] preparing $cwd" >&2

  # --- BEGIN generated: secrets ---
  # No gitignored runtime files to copy in this repo.
  # --- END generated: secrets ---

  # --- BEGIN generated: ports ---
  # No per-worktree port collisions in this repo (no dev server / DB / containers).
  # --- END generated: ports ---

  # --- BEGIN generated: caches ---
  # No shared-cache symlinks (clean reinstall; Bun's global cache keeps it fast).
  # --- END generated: caches ---

  # --- BEGIN generated: installs ---
  # Bun workspace — a root install also wires the sub-package workspaces.
  command -v bun >/dev/null && [ -f bun.lock ] && bun install
  # --- END generated: installs ---

  echo "[worktree-setup] done" >&2
} >&2

touch "$marker"
