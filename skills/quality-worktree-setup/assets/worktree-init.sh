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

# The main checkout root — copy secrets / symlink shared caches from here.
# shellcheck disable=SC2034  # referenced by the generated regions below
main_root=$(git -C "$cwd" worktree list --porcelain | awk '/^worktree /{print $2; exit}')

# Everything below logs to stderr.
{
  cd "$cwd"
  echo "[worktree-setup] preparing $cwd" >&2

  # --- BEGIN generated: secrets ---
  # Most gitignored files are copied declaratively by .worktreeinclude. Put
  # ONLY files that need transformation, or that .worktreeinclude can't reach,
  # here. quality-worktree-setup fills these copy lines if the repo needs them.
  # Example:
  #   [ -f "$main_root/.env" ] && cp "$main_root/.env" "$cwd/.env"
  # --- END generated: secrets ---

  # --- BEGIN generated: ports ---
  # Deterministic per-worktree port so parallel worktrees don't collide.
  # quality-worktree-setup fills this if the repo runs a dev server. Example:
  #   branch=$(git -C "$cwd" rev-parse --abbrev-ref HEAD)
  #   port=$(( 20000 + $(printf '%s' "$branch" | cksum | cut -d' ' -f1) % 20000 ))
  #   printf 'PORT=%s\n' "$port" >> "$cwd/.env.local"
  # --- END generated: ports ---

  # --- BEGIN generated: caches ---
  # Symlink a shared cache to skip a reinstall. OPT-IN — symlinking
  # node_modules makes worktree installs mutate the main checkout; only enable
  # when the user accepted that tradeoff. Example:
  #   [ -d "$main_root/node_modules" ] && [ ! -e "$cwd/node_modules" ] \
  #     && ln -s "$main_root/node_modules" "$cwd/node_modules"
  # --- END generated: caches ---

  # --- BEGIN generated: installs ---
  # Install/build commands detected for this repo. quality-worktree-setup
  # fills these. Examples:
  #   command -v uv >/dev/null && [ -f uv.lock ] && uv sync
  #   [ -f package.json ] && bun install
  #   [ -f ui/package.json ] && ( cd ui && npm install )
  # --- END generated: installs ---

  echo "[worktree-setup] done" >&2
} >&2

touch "$marker"
