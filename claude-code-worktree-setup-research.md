# Running Setup Scripts on Claude Code Worktrees

Research note — verified against Claude Code **v2.1.176**, official docs, the installed
binary, and community implementations. Last verified: 2026-06-22.

## Question

Can you make Claude Code automatically run a setup script (copy `.env`, `uv sync`,
`npm install`, etc.) when you start a session with `claude --worktree`?

## TL;DR

- Yes. The hook event is **`WorktreeCreate`** (paired with `WorktreeRemove`). There is
  **no** `WorktreeSetup` event — that name does not exist.
- `WorktreeCreate` **replaces** git's default worktree creation; it does not run *in
  addition* to it. A true "run after git creates the worktree" hook
  (`PostWorktreeCreate`) is an **open feature request**, not shipped — see
  [#27744](https://github.com/anthropics/claude-code/issues/27744).
- You do **not** have to fully reimplement git. Three options exist; two avoid touching
  git creation entirely.

## Verification

The event name was confirmed three independent ways:

1. **Installed binary** (`/opt/homebrew/bin/claude` → Caskroom v2.1.176): the string
   `WorktreeCreate` appears 66 times, `WorktreeRemove` 35 times, `WorktreeSetup` **0**.
2. **Hooks doc** (`code.claude.com/docs/en/hooks`): *"WorktreeCreate — When a worktree
   is being created via `--worktree` or `isolation: "worktree"`. Replaces default git
   behavior."*
3. **Worktrees doc** (`code.claude.com/docs/en/worktrees`): ships a working
   `"WorktreeCreate"` JSON example and pairs it with `WorktreeRemove`.

## The `--worktree` flag (baseline behavior)

```bash
claude --worktree feature-auth      # or  -w feature-auth
claude --worktree                   # auto-generates a name e.g. bright-running-fox
claude --worktree "#1234"           # branch from PR #1234
claude --worktree feature-auth --tmux   # also open a tmux session for it
```

- Worktree is created at `.claude/worktrees/<name>/` on a new branch `worktree-<name>`.
- Branches from `origin/HEAD` by default (falls back to local `HEAD` if no remote).
- Settings knob `worktree.baseRef`: `"fresh"` (default) or `"head"` (carry unpushed
  commits). Only affects the *default* creation path, not a `WorktreeCreate` hook.
- First interactive use in a directory requires accepting the trust dialog — run plain
  `claude` once there first. `claude -p --worktree` skips the trust check.
- Tip: add `.claude/worktrees/` to `.gitignore`.

## The three approaches

| Approach            | Replaces git? | Runs commands? | Output timing        | Notes |
|---------------------|:-------------:|:--------------:|----------------------|-------|
| `.worktreeinclude`  | No            | No (files only)| —                    | Copies gitignored files on default creation |
| `SessionStart` hook | **No**        | Yes            | After TUI renders    | Additive; fires every session (needs a guard) |
| `WorktreeCreate`    | **Yes**       | Yes            | Before TUI renders   | Clean output, but you own creation |

Key nuances:

- **`.worktreeinclude` is bypassed when a `WorktreeCreate` hook is configured** — copy
  config files yourself inside the hook. With the `SessionStart` path, default creation
  runs, so `.worktreeinclude` still works and composes with the hook.
- The `WorktreeCreate` "replace" is not heavy in practice — you call the same one-liner
  git would (`git worktree add -b "worktree-$NAME" "$path" HEAD`) then do setup. But
  this mirrors Claude's internal defaults (branch name, base ref, path), which #27744
  calls out as *"fragile … if the default behavior changes … the hook silently creates
  incompatible worktrees."*

---

## Option 1 — `.worktreeinclude` (files only, no hook)

Drop at repo root. `.gitignore` syntax. Copies only files that match a pattern **and**
are gitignored (tracked files are never duplicated). Auto-applies to `--worktree`,
subagent worktrees, and desktop parallel sessions.

```text
# .worktreeinclude
.env
.env.local
config/secrets.json
```

## Option 2 — additive recipe (no git replacement): `.worktreeinclude` + `SessionStart`

`.worktreeinclude` handles env files via Claude's normal creation; the `SessionStart`
hook runs the installs. Git is never touched, so this is future-proof.

`.claude/settings.json`:
```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/worktree-init.sh",
            "timeout": 300
          }
        ]
      }
    ]
  }
}
```

`.claude/hooks/worktree-init.sh` (`chmod +x`):
```bash
#!/usr/bin/env bash
set -euo pipefail
input=$(cat)
cwd=$(printf '%s' "$input" | jq -r '.cwd')

# Only act inside a linked worktree (git-dir != git-common-dir); skip the main checkout.
[ "$(git -C "$cwd" rev-parse --git-dir 2>/dev/null)" = \
  "$(git -C "$cwd" rev-parse --git-common-dir 2>/dev/null)" ] && exit 0

marker="$cwd/.claude-worktree-ready"
[ -f "$marker" ] && exit 0          # run once per worktree, not on every resume

{ cd "$cwd"
  [ -f uv.lock ] && command -v uv >/dev/null && uv sync
  [ -f ui/package.json ] && ( cd ui && npm install )
} >&2                                # logs to stderr; SessionStart has no stdout contract
touch "$marker"
```

Tradeoff: leaves git alone and is future-proof, but install output interleaves with
Claude's startup banner and blocks session start briefly.

`SessionStart` matchers: `startup` (new session), `resume` (`--resume`/`--continue`/
`/resume`), `clear` (`/clear`), `compact` (compaction).

## Option 3 — `WorktreeCreate` hook (runs before the TUI; you own creation)

Use when you want setup done before the TUI appears, or for non-git VCS. **Contract:
print the worktree path on stdout and nothing else; a missing path or non-zero exit
fails creation.** Send all logging to stderr. Runs synchronously.

`.claude/settings.json`:
```json
{
  "hooks": {
    "WorktreeCreate": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/worktree-create.sh",
            "timeout": 300
          }
        ]
      }
    ]
  }
}
```

`.claude/hooks/worktree-create.sh` (`chmod +x`):
```bash
#!/usr/bin/env bash
set -euo pipefail
input=$(cat)
name=$(printf '%s' "$input" | jq -r '.name')

repo=$(git rev-parse --show-toplevel)
dir="$repo/.claude/worktrees/$name"
branch="worktree-$name"

# Everything here goes to stderr — stdout must contain ONLY the final path.
{
  git -C "$repo" worktree add -b "$branch" "$dir" origin/HEAD

  # .worktreeinclude is bypassed when this hook exists — copy config files yourself.
  for f in .env .env.local; do
    [ -f "$repo/$f" ] && cp "$repo/$f" "$dir/$f"
  done

  cd "$dir"
  command -v uv >/dev/null && [ -f uv.lock ] && uv sync
  [ -f ui/package.json ] && ( cd ui && npm install )
} >&2

printf '%s\n' "$dir"      # REQUIRED: tell Claude where the worktree lives
```

Pair with a `WorktreeRemove` hook for custom cleanup. The hook stdin schema is not fully
documented; the reliable field is `.name` (used by the official non-git example) — build
paths from it rather than assuming other fields.

## Default worktree cleanup (for reference)

- No changes/untracked/new commits → worktree + branch removed automatically (prompts if
  the session is named).
- Changes present → Claude prompts to keep or remove.
- `-p` non-interactive runs are never auto-cleaned → `git worktree remove`.
- Subagent/background worktrees are swept after `cleanupPeriodDays`; `--worktree` ones
  are never swept.

## How people do it in the wild

- **[tfriedel/claude-worktree-hooks](https://github.com/tfriedel/claude-worktree-hooks)**
  — most complete example. `WorktreeCreate`; calls
  `git worktree add -b "$BRANCH" "$WORKTREE_PATH" HEAD >/dev/null 2>&1` (redirect git's
  stdout away — only the path may go to stdout), copies `.env`/`.env.local`, runs
  `npm install`, and hashes the branch name into a deterministic port to avoid
  collisions across parallel worktrees.
- **[eshaham's gist](https://gist.github.com/eshaham/7f4501f227be78f2d73aeee1fcd8a125)**
  — auto-setup with husky hooks, MCP servers, symlinked `node_modules`.
- **[mattbrailsford.dev](https://mattbrailsford.dev/replacing-my-custom-git-worktree-skill-with-claude-code-hooks)**
  — replaced a custom worktree skill with hooks; documents the "`SessionStart` runs after
  the TUI (output interleaves) vs `WorktreeCreate` runs before it (clean)" tradeoff.
- **[Feature request #27744](https://github.com/anthropics/claude-code/issues/27744)** —
  open; wants an additive `PostWorktreeCreate` hook and floats a lighter alternative: a
  `worktree.setupFiles` settings block with copy/symlink strategies.

## Recommendation

- Env files only → `.worktreeinclude`.
- Run `uv sync` + `npm install` without owning git creation → Option 2
  (`.worktreeinclude` + `SessionStart`).
- Setup must finish before the TUI appears, or non-git VCS → Option 3 (`WorktreeCreate`),
  accepting the "mirrors internal defaults, can drift" caveat.

## Sources

- [Claude Code hooks reference](https://code.claude.com/docs/en/hooks)
- [Claude Code worktrees docs](https://code.claude.com/docs/en/worktrees)
- [Common workflows — worktrees](https://code.claude.com/docs/en/common-workflows)
- [tfriedel/claude-worktree-hooks](https://github.com/tfriedel/claude-worktree-hooks)
- [Feature request #27744 — PostWorktreeCreate](https://github.com/anthropics/claude-code/issues/27744)
- [eshaham gist — worktree auto-setup](https://gist.github.com/eshaham/7f4501f227be78f2d73aeee1fcd8a125)
- [mattbrailsford.dev — worktree hooks](https://mattbrailsford.dev/replacing-my-custom-git-worktree-skill-with-claude-code-hooks)
