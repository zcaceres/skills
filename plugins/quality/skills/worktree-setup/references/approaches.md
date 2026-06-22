# Worktree auto-setup — approaches, decision logic, gotchas

Operational reference for `quality-worktree-setup`. Verified against Claude Code
**v2.1.176** and the official hooks/worktrees docs. Read this before choosing an
approach or generating files.

## What `--worktree` does by default

```bash
claude --worktree feature-auth     # or -w; auto-generates a name if omitted
claude -p --worktree throwaway     # -p (print) mode skips the trust dialog
```

- Worktree is created at `.claude/worktrees/<name>/` on branch `worktree-<name>`.
- Branches from `origin/HEAD` (falls back to local `HEAD` with no remote).
- Setting `worktree.baseRef`: `"fresh"` (default) or `"head"` (carry unpushed
  commits). Only affects the *default* creation path — a `WorktreeCreate` hook
  bypasses it.
- A fresh worktree is missing every **gitignored** file (`.env`, local config,
  caches, `node_modules`) and has run no install/build step. That gap is what
  this skill fills.

## The two mechanisms (plus a files-only helper)

`.worktreeinclude` copies files but runs no commands, so it is never the whole
answer once installs are involved. The real choice is **where command-running
logic lives**.

| Axis | `SessionStart` hook (Option 2) | `WorktreeCreate` hook (Option 3) |
|---|---|---|
| Owns git creation? | No — Claude creates, hook runs after | **Yes** — you reimplement `git worktree add` |
| Fragility | Future-proof; Claude's defaults can change freely | Mirrors internal defaults (branch name, `origin/HEAD`, `baseRef`); silent drift if they change ([#27744]) |
| File copy | `.worktreeinclude` still works (declarative) | `.worktreeinclude` is **bypassed** — `cp` files yourself |
| Fires | Every session (startup/resume/clear/compact) → **needs a run-once marker** | Exactly once at creation → naturally idempotent |
| stdout contract | None — log freely to stderr | **Strict**: stdout = the worktree path and nothing else |
| Failure blast radius | Worktree exists but unconfigured; just re-run | Non-zero exit / missing path **fails creation entirely** |
| Timing | After the TUI renders; output interleaves, blocks briefly | Before the TUI; clean output, setup done on landing |

`WorktreeCreate` buys cleaner timing and costs safety. Feature request
[#27744] asks for an *additive* `PostWorktreeCreate` precisely because the
replace-semantics of `WorktreeCreate` are fragile.

## Decision logic

Default to `SessionStart` (Option 2). Escalate to `WorktreeCreate` only on a
genuine trigger:

1. **Files only, no installs** → `.worktreeinclude` alone.
2. **Files + installs/ports/symlinks** → **DEFAULT:** `.worktreeinclude`
   (files) + `SessionStart` init script (commands). Never touches git, can't
   drift. Ports and symlinks live here fine — see below.
3. Escalate to **`WorktreeCreate`** only when:
   - setup *must* be 100% complete before the TUI appears (e.g. an agent that
     immediately runs a command needing deps), **or**
   - the repo uses a **non-git VCS** (Claude's default git creation won't work).

   Escalation is opt-in during the interview, never automatic — it is the
   riskier path.

## Ports and symlinks work under either hook

Per-worktree ports do **not** force `WorktreeCreate`. `SessionStart` receives
`.cwd` on stdin, so the init script can derive the branch and hash a stable
port; the run-once marker keeps it stable for the worktree's life.

**Deterministic port from branch name** (POSIX `cksum`, no collisions across
parallel worktrees):

```bash
branch=$(git -C "$cwd" rev-parse --abbrev-ref HEAD)
port=$(( 20000 + $(printf '%s' "$branch" | cksum | cut -d' ' -f1) % 20000 ))
printf 'PORT=%s\n' "$port" >> "$cwd/.env.local"   # write where the app reads it
```

**Symlink a shared cache** (skip a reinstall) — find the main checkout robustly
via the first `git worktree list` entry:

```bash
main_root=$(git -C "$cwd" worktree list --porcelain | awk '/^worktree /{print $2; exit}')
[ -d "$main_root/node_modules" ] && [ ! -e "$cwd/node_modules" ] \
  && ln -s "$main_root/node_modules" "$cwd/node_modules"
```

**Symlink caveat — confirm with the user before generating it.** Symlinking
`node_modules` means an install in the worktree mutates the main checkout's
modules, and breaks when a worktree needs a different lockfile or has native
deps built for a different state. Safer alternatives: symlink a *global content
store* (pnpm's `~/.local/share/pnpm/store`, bun's `~/.bun/install/cache`) and
run a fast linking install, or just reinstall. Default to reinstall unless the
user opts into the symlink and accepts the shared-mutation risk.

## Non-negotiable correctness details

Bake these into every generated hook:

- **Worktree-only guard (SessionStart only).** The hook fires in the launch
  checkout too, so it must skip anything that isn't a `claude --worktree`
  worktree. Gate on the path — those worktrees live under `.claude/worktrees/`:
  ```bash
  case "$cwd" in
    */.claude/worktrees/*) : ;;   # a claude --worktree worktree → proceed
    *) exit 0 ;;                   # primary checkout / unrelated dir → no-op
  esac
  ```
  Do **not** use the common `git-dir != git-common-dir` ("am I a linked
  worktree?") test as the sole guard. It wrongly fires when Claude is launched
  from a linked worktree that *isn't* a `--worktree` one — e.g. a Conductor
  workspace, which is itself a linked worktree — running setup (and dropping a
  marker) in the user's working checkout. The path test is correct regardless
  of where the session was launched.
- **Run-once marker (SessionStart only).** SessionStart fires on every
  resume/clear/compact. Gate setup on a marker so it runs once per worktree:
  ```bash
  marker="$cwd/.claude-worktree-ready"; [ -f "$marker" ] && exit 0
  # ... do setup ...
  touch "$marker"
  ```
- **stdout discipline (WorktreeCreate only).** stdout must be ONLY the final
  path. Wrap all work in `{ ...; } >&2` and `printf '%s\n' "$dir"` last.
  Redirect git's own stdout (`git worktree add ... 2>&1` inside the `>&2`
  block) — a stray line breaks creation.
- **`set -euo pipefail`** in both, and `jq` to parse the stdin JSON
  (`.cwd` for SessionStart, `.name` for WorktreeCreate — `.name` is the one
  reliably-documented WorktreeCreate field; build paths from it).
- **Managed-region markers.** Wrap every generated block in
  `# --- BEGIN generated: <id> ---` / `# --- END generated: <id> ---` so update
  mode can rewrite just those regions and leave hand edits alone.
- **`chmod +x`** the hook scripts.

## Hook wiring (`.claude/settings.json`)

Merge — never clobber — into existing `hooks`.

SessionStart:
```json
{ "hooks": { "SessionStart": [ { "matcher": "startup",
  "hooks": [ { "type": "command",
    "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/worktree-init.sh",
    "timeout": 300 } ] } ] } }
```

WorktreeCreate (note: no `matcher`):
```json
{ "hooks": { "WorktreeCreate": [
  { "hooks": [ { "type": "command",
    "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/worktree-create.sh",
    "timeout": 300 } ] } ] } }
```

`SessionStart` matchers: `startup`, `resume`, `clear`, `compact`. Use
`startup` only (setup belongs on a new session, not every resume; the marker
backs this up). Pair a `WorktreeCreate` hook with `WorktreeRemove` only if the
repo needs custom teardown (e.g. dropping a per-worktree DB).

Always add `.claude/worktrees/` to `.gitignore`.

## Verify (smoke test)

`-p` mode skips the trust dialog, so a throwaway worktree can be created
non-interactively, asserted, and torn down:

```bash
name="qws-smoke-$$"
claude -p --worktree "$name" "exit" >/dev/null 2>&1 || true
dir=".claude/worktrees/$name"
# assert: expected files present, install artifacts exist (node_modules/.venv),
#         marker written, port file present if configured
git worktree remove --force "$dir" 2>/dev/null || true
git branch -D "worktree-$name" 2>/dev/null || true
```

`-p` runs are never auto-cleaned, so always remove the worktree + branch after.
If a live test is undesirable (slow installs), fall back to static checks:
`bash -n` + `shellcheck` the hook, and confirm `.claude/settings.json` parses
with `jq`.

## Default cleanup behavior (for reference)

- Clean worktree (no changes/commits) → removed automatically.
- Changes present → Claude prompts keep/remove.
- `-p` runs are never auto-cleaned → `git worktree remove`.

## Sources

- [Claude Code hooks reference](https://code.claude.com/docs/en/hooks)
- [Claude Code worktrees docs](https://code.claude.com/docs/en/worktrees)
- [tfriedel/claude-worktree-hooks](https://github.com/tfriedel/claude-worktree-hooks)
- [#27744 — PostWorktreeCreate feature request][#27744]

[#27744]: https://github.com/anthropics/claude-code/issues/27744
