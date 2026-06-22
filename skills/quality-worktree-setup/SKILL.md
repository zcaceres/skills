---
name: quality-worktree-setup
description: Bootstrap and maintain Claude Code worktree auto-setup for a repo. Interviews the codebase for what a fresh `claude --worktree` actually needs — gitignored files, install/build steps, per-worktree ports, shared caches — then generates, wires, and smoke-tests the right `.worktreeinclude` + hook. Re-run to update the config when the repo changes. User-triggered via `/quality-worktree-setup [setup|update|check]`.
argument-hint: "[setup | update | check]"
disable-model-invocation: true
---

# quality-worktree-setup

When you start a session with `claude --worktree`, the new worktree is missing
every **gitignored** file (`.env`, local config, certs) and has run no install
or build step — so it often can't run. This skill makes a repo set itself up
automatically on every new worktree. It does that by **interviewing the
codebase** for what a fresh worktree needs, then generating and verifying the
right files and hooks. It is not a drop-in template: the value is the
discovery + the human-in-the-loop confirmation of what belongs in *this* repo.

It has three modes:

- **setup** — first-time bootstrap. Discover → confirm → generate → verify. Once.
- **update** — re-discover, diff against the existing managed config, propose a
  patch. Run whenever the repo's tooling or secrets change.
- **check** — verify the current config (optionally a live smoke test) without
  changing anything.

## When to use

User-triggered only. Activate on:
- `/quality-worktree-setup` — auto-pick: **update** if a managed config exists,
  **setup** otherwise.
- `/quality-worktree-setup setup` — force the bootstrap interview.
- `/quality-worktree-setup update` — re-discover and diff against existing config.
- `/quality-worktree-setup check` — verify only; never writes.

Do not self-activate on related phrasing ("set up worktrees", "fix my .env").
Surface the slash command and let the user decide.

## Read this first

Read `references/approaches.md` before choosing an approach or writing any file.
It carries the verified hook contracts, the SessionStart-vs-WorktreeCreate
tradeoff table, the port/symlink snippets, and the non-negotiable correctness
details (linked-worktree guard, run-once marker, stdout discipline). Do not
rely on memory for hook event names or contracts — they're in that file.

## Mode dispatch — run this first

Detect whether this skill already manages worktree setup here:

```bash
root=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "not a git repo"; }
managed=0
for f in "$root/.claude/hooks/worktree-init.sh" "$root/.claude/hooks/worktree-create.sh"; do
  [ -f "$f" ] && grep -q "managed by quality-worktree-setup" "$f" && managed=1
done
echo "root=$root managed=$managed"
```

- No argument + `managed=0` → **setup**.
- No argument + `managed=1` → **update**.
- Explicit `setup` / `update` / `check` → that mode. (`update`/`check` with
  `managed=0`: tell the user nothing is configured yet and offer to run setup.)

If `git rev-parse` fails, the repo isn't git. The default git creation path
won't work, so only the `WorktreeCreate` (non-git) path is viable — say so and
confirm the user still wants to proceed.

---

## Phase D — Discover (the interview)

Inspect the repo and build a **worktree spec** across four buckets. Investigate,
then present findings and let the user edit before generating anything. Never
print secret *values* — only filenames.

### 1. Gitignored-but-needed files

A fresh worktree starts without these. Find what's present and untracked:

```bash
git -C "$root" status --ignored --porcelain | grep '^!!' | sed 's/^!! //'
```

Focus on runtime-required, non-regenerable files — `.env*`, `config/secrets*`,
`*.pem` / certs, service-account JSONs, `.npmrc`/`.netrc` with tokens, local
SQLite DBs. **Exclude** regenerable junk (`node_modules`, `.venv`, `dist`,
`__pycache__`, caches) — those come from installs or symlinks, not copies.
Cross-reference `.env.example` / `.env.sample` to learn which env files the repo
*expects*. Present the candidate list and let the user add/remove.

### 2. Install / build steps

Detect the toolchain from manifests + lockfiles, and **prefer an existing
setup target** over inventing commands:

- Check for a ready-made entry point first: a `setup`/`bootstrap`/`dev:setup`
  script in `package.json`, a `Makefile`/`Justfile` target, `bin/setup`,
  `script/bootstrap`. If one exists, propose reusing it.
- Otherwise infer per ecosystem: `uv.lock`→`uv sync`; `poetry.lock`→`poetry
  install`; `requirements.txt`→`pip install -r`; `package.json` + lockfile →
  the matching `bun`/`pnpm`/`npm ci`/`yarn`; `Cargo.toml`→`cargo build`;
  `go.mod`→`go mod download`; `Gemfile`→`bundle install`; `composer.json`→
  `composer install`.
- Walk monorepo sub-packages (e.g. `ui/package.json`, workspaces) — each may
  need its own install.
- Guard each command with a tool/file check (`command -v uv >/dev/null && [ -f
  uv.lock ] && …`) so a missing tool degrades gracefully.

### 3. Per-worktree collision risks

Parallel worktrees clash on fixed resources. Grep for hard-coded dev-server
**ports** (`PORT=`, `listen(3000)`, `vite`/`next`/`rails` defaults), fixed
local **DB/Redis names**, and fixed **container/compose names**. For each
clashing resource, propose the deterministic port-hash snippet from
`references/approaches.md` (stable per branch, unique across worktrees), and
ask where the value is read (which env file / config) so the script writes it
correctly.

### 4. Shared / heavy artifacts

Identify large regenerable trees (`node_modules`, model files, build caches)
that could be symlinked from the main checkout instead of reinstalled.
**Symlinking is opt-in and has real tradeoffs** (a worktree install mutates the
main checkout; breaks with diverging lockfiles or native deps) — present it
with the caveat from `references/approaches.md` and default to a clean
reinstall unless the user accepts the risk. When they want speed without the
risk, prefer symlinking a *global package store* + a fast linking install.

At the end of Phase D, show the assembled spec (files / installs / ports /
caches) and get explicit confirmation. This confirmation is the point of the
skill — do not skip it.

---

## Phase C — Choose the approach

Apply the decision logic from `references/approaches.md`:

- **Files only, no installs** → `.worktreeinclude` alone.
- **Files + installs/ports/symlinks** → **DEFAULT: `.worktreeinclude` (files) +
  `SessionStart` init script (commands).** Future-proof, never touches git,
  forgiving on failure. Ports and symlinks live in the init script.
- **Escalate to `WorktreeCreate`** only when (a) setup must finish *before* the
  TUI appears, or (b) the repo is non-git. Present this as an explicit opt-in
  with its tradeoffs (you own git creation, can drift, strict stdout contract,
  failure blocks worktree creation, `.worktreeinclude` bypassed) — never pick
  it silently.

State which approach you chose and why before generating.

---

## Phase G — Generate

Copy the matching template from `assets/` and fill its `--- BEGIN/END generated:
<id> ---` regions with the confirmed spec. Keep the `managed by
quality-worktree-setup` header — update mode keys off it. Concretely:

1. **Files** → write/extend `.worktreeinclude` from `assets/worktreeinclude.example`
   with the confirmed gitignored files. (Under the `WorktreeCreate` path,
   `.worktreeinclude` is bypassed — put the `cp` lines in the hook's `secrets`
   region instead.)
2. **Hook script** → copy `assets/worktree-init.sh` (SessionStart) or
   `assets/worktree-create.sh` (WorktreeCreate) to `.claude/hooks/`, fill the
   generated regions (installs, ports, caches, and secrets when applicable),
   then `chmod +x`.
3. **Wire the hook** → merge the matching block from
   `assets/settings.snippet.json` into `.claude/settings.json`. **Merge, never
   overwrite** — read existing JSON, add to the relevant `hooks` array,
   preserve everything else. Validate the result parses (`jq . < file`).
4. **gitignore** → ensure `.claude/worktrees/` is in `.gitignore` (add if
   missing).

Show a diff/summary of every file touched.

---

## Phase V — Verify

Confirm the config actually works. Default to the live smoke test; offer the
static fallback when installs would be slow or the user declines.

**Live smoke test** (uses `-p` to skip the trust dialog; see
`references/approaches.md`):

```bash
name="qws-smoke-$$"
claude -p --worktree "$name" "exit" >/dev/null 2>&1 || true
dir="$root/.claude/worktrees/$name"
# Assert: expected gitignored files landed, install artifacts exist
# (node_modules / .venv / target …), the .claude-worktree-ready marker was
# written (SessionStart path), and any port file is present.
git -C "$root" worktree remove --force "$dir" 2>/dev/null || true
git -C "$root" branch -D "worktree-$name" 2>/dev/null || true
```

Always tear the throwaway worktree + branch down afterward (`-p` worktrees are
never auto-cleaned). Report exactly what was asserted and what passed/failed.

**Static fallback:** `bash -n` and `shellcheck` the hook script(s), and confirm
`.claude/settings.json` parses with `jq`. Say that you ran the static check
instead of a live run, and why.

---

## Update mode

1. Re-run Phase D against the current repo → a fresh spec.
2. Read the existing managed files; diff the fresh spec against the
   `--- generated: <id> ---` regions only.
3. Present the delta in plain terms ("repo added a `pnpm` workspace and a
   `STRIPE_KEY` env var → add `pnpm install` to installs and `.env` to
   `.worktreeinclude`; the `vite` port moved → update the port region").
4. On approval, rewrite only the affected generated regions — never touch hand
   edits outside them or unrelated keys in `.claude/settings.json`.
5. Re-run Phase V.

If the repo's needs now cross an escalation trigger (e.g. setup must precede the
TUI), say so and offer to migrate SessionStart → WorktreeCreate.

## Check mode

Run Phase V against the existing config and report. Never writes. If `managed=0`,
say nothing is configured and offer setup.

## Guardrails

- **Never print secret values.** Reference secret files by name only; never cat
  `.env` or copy its contents into your output. (The repo's `.env` guard may
  block reads outright — respect it.)
- **Merge, don't clobber** `.claude/settings.json` and `.gitignore`.
- **Only rewrite managed regions** in update mode.
- **Don't commit** unless the user asks. When you do, the hook scripts +
  `.worktreeinclude` + `.gitignore` + `.claude/settings.json` belong in the
  commit; `.claude/worktrees/` stays ignored.
- The hook runs setup commands on every new worktree — keep them idempotent and
  guarded, and call out anything slow or destructive before generating it.

## Output

Close with a short summary:
- Mode run and the approach chosen (+ why).
- Files created/changed (paths).
- What the spec covers (files / installs / ports / caches).
- Verification result (live smoke test or static check, pass/fail).
- How to use it: `claude --worktree <name>`, and `/quality-worktree-setup
  update` when the repo's tooling changes.
