#!/usr/bin/env bash
# managed by quality-worktree-setup — re-run `/quality-worktree-setup update` to regenerate.
#
# WorktreeCreate hook: REPLACES git's default worktree creation. You own
# creation here, and .worktreeinclude is BYPASSED — copy files yourself.
# Use this only when setup must finish before the TUI appears, or for non-git
# VCS. Otherwise prefer the SessionStart path (worktree-init.sh).
#
# Contract: print ONLY the worktree path on stdout; everything else → stderr.
# A non-zero exit or a missing path FAILS worktree creation entirely.
set -euo pipefail

input=$(cat)
name=$(printf '%s' "$input" | jq -r '.name')

repo=$(git rev-parse --show-toplevel)
dir="$repo/.claude/worktrees/$name"
branch="worktree-$name"
# shellcheck disable=SC2034  # referenced by the generated regions below
main_root="$repo"

# Everything below goes to stderr — stdout must contain ONLY the final path.
{
  # Mirror Claude's default creation. NOTE: this mirrors internal defaults
  # (branch name, origin/HEAD base). If those change upstream this hook can
  # silently create incompatible worktrees — see issue #27744.
  git -C "$repo" worktree add -b "$branch" "$dir" origin/HEAD 2>&1 \
    || git -C "$repo" worktree add -b "$branch" "$dir" HEAD     # no-remote fallback

  cd "$dir"

  # --- BEGIN generated: secrets ---
  # .worktreeinclude is bypassed under this hook — copy gitignored files here.
  # quality-worktree-setup fills these. Example:
  #   for f in .env .env.local; do
  #     [ -f "$main_root/$f" ] && cp "$main_root/$f" "$dir/$f"
  #   done
  # --- END generated: secrets ---

  # --- BEGIN generated: ports ---
  # quality-worktree-setup fills deterministic port assignment if needed.
  # Example (the worktree name is stable and unique here):
  #   port=$(( 20000 + $(printf '%s' "$name" | cksum | cut -d' ' -f1) % 20000 ))
  #   printf 'PORT=%s\n' "$port" >> "$dir/.env.local"
  # --- END generated: ports ---

  # --- BEGIN generated: caches ---
  # OPT-IN shared-cache symlink (see worktree-init.sh for the tradeoff).
  # --- END generated: caches ---

  # --- BEGIN generated: installs ---
  # Install/build commands detected for this repo. Example:
  #   command -v uv >/dev/null && [ -f uv.lock ] && uv sync
  #   [ -f package.json ] && bun install
  # --- END generated: installs ---
} >&2

printf '%s\n' "$dir"   # REQUIRED: tell Claude where the worktree lives
