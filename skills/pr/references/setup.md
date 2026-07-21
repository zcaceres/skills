# `/pr setup` — Persistent `/pr` Settings

Show and change the three persistent `/pr` settings. A repo-scoped value
always overrides a user-scoped one, and **which config store holds them
depends on the VCS** (see the store note below):

- **vcs** (`pr.vcs`) — drive the workflow with **git** (default) or
  **jj** (jujutsu). Usually you don't set this: detection is structural
  (a git repo → git, a native jj repo → jj). It only matters in a
  **colocated** repo where both `.git` and `.jj` exist — there git is the
  default and `pr.vcs jj` opts into the jj recipes. The resolved VCS
  decides which `references/<vcs>/` recipes run *and* which config store
  the other two settings live in.
- **mode** (`pr.mode`) — switch between **normal** (default) and
  **stacked**. Controls only what the bare `/pr` (default) action does:
  - **normal** → `/pr` commits your conversation changes, pushes, and
    opens a single PR against the trunk (see [update.md](git/update.md)).
  - **stacked** → `/pr` cuts the current diff as the next branch in a
    stack and opens a PR against its parent (see [checkpoint.md](git/checkpoint.md)).
- **draft default** (`pr.draft`) — when `true`, every PR this skill
  **creates** is opened as a draft unless the invocation passes
  `--ready`/`--no-draft`. Orthogonal to the mode; applies to both flows.

**Config store.** In a git or colocated repo the settings live in
`git config` (`--local` / `--global`). In a **native jj** repo (no
`.git`) they live in `jj config` (`--repo` / `--user`); `jj config get`
exits non-zero when a key is unset, so treat a read failure as unset.
Both stores put the repo scope over the user scope. **Split-brain
caveat:** a `--global` default set in `git config` does **not** carry to
`jj config` (they're different files) — someone who works in both
native-jj and git repos sets their default in each.

Named subcommands (`update`, `log`, `merge`, `checkpoint`, `submit`,
`sync`) work in either mode regardless of these settings. The draft
default affects PR creation only; a per-invocation `--draft`/`-d` or
`--ready`/`--no-draft` always overrides it for that run.

> **jj recipes ship in `references/jj/`.** Until they're present, setting
> `pr.vcs jj` resolves but falls back to the git recipes with a note.

## What the user asked to change

`/pr setup` manages all three settings. Figure out which the invocation
targets, then only touch that one:

- VCS words → `git`, `jj` (e.g. `/pr setup jj`).
- Mode words → `normal`, `stacked` (e.g. `/pr setup stacked`).
- Draft words → `draft`, `--draft`, `draft on` (turn on); `no-draft`,
  `--no-draft`, `ready`, `draft off` (turn off) (e.g. `/pr setup draft`).
- Combining is fine: `/pr setup jj stacked draft`.
- No setting word → show everything (step 1) and ask which to change.

A `--global` / `--local` token sets the scope for whatever is written
(default **global**; the jj store calls these `--user` / `--repo`).

## Workflow

### 1. Show the current settings

First resolve the VCS structurally, then report the detected repo type,
any configured `pr.vcs` override, and the mode/draft settings from the
matching store:

```bash
git rev-parse --show-toplevel >/dev/null 2>&1 && HAS_GIT=1 || HAS_GIT=0
jj root                       >/dev/null 2>&1 && HAS_JJ=1  || HAS_JJ=0

if   [ "$HAS_GIT" = 1 ] && [ "$HAS_JJ" = 1 ]; then DETECTED="colocated (git + jj)"
elif [ "$HAS_GIT" = 1 ];                      then DETECTED="git"
elif [ "$HAS_JJ" = 1 ];                       then DETECTED="jj (native)"
else DETECTED="(not a repo)"; fi
echo "repo:  $DETECTED"

# Read settings from the store that matches the repo. git/colocated -> git config;
# native jj -> jj config (get exits non-zero when unset).
if [ "$HAS_GIT" = 1 ]; then
  echo "vcs    configured: $(git config pr.vcs 2>/dev/null || echo '(unset -> git)')"
  echo "mode   active: $(git config pr.mode 2>/dev/null || echo 'normal (default)')"
  echo "draft  active: $([ "$(git config pr.draft 2>/dev/null)" = true ] && echo 'on' || echo 'off')"
else
  echo "vcs    configured: $(jj config get pr.vcs 2>/dev/null || echo '(unset -> jj)')"
  echo "mode   active: $(jj config get pr.mode 2>/dev/null || echo 'normal (default)')"
  echo "draft  active: $([ "$(jj config get pr.draft 2>/dev/null)" = true ] && echo 'on' || echo 'off')"
fi
```

In a **colocated** repo the resolved VCS is **git** unless `pr.vcs` says
`jj`. If `pr.mode` is unset the active mode is **normal**; if `pr.draft`
is unset (or not `true`) new PRs default to **ready**.

### 2. Ask the user what they want

If the invocation already made it clear (e.g. `/pr setup stacked`,
`/pr setup draft`, `/pr setup --global stacked`, `/pr setup no-draft`),
skip the question and go straight to step 3. Otherwise ask which
setting(s) to change:

- VCS? `git` or `jj` (only meaningful in a colocated repo).
- Mode? `normal` or `stacked`.
- Drafts by default? `on` or `off`.
- Scope? **global** (applies to every repo on this machine — the right
  choice if you always work this way) or **local** (this repo only).

Default to **global** scope unless the user asks for local — most people
want one consistent setup everywhere.

### 3. Write the setting(s)

Only write the keys the user is changing. Global is the recommended
default; pass `--local` to scope to this repo.

**Pick the store from the repo type** (step 1's `$HAS_GIT`): a git or
colocated repo writes to `git config`; a native jj repo writes to
`jj config`, where `--global`↔`--user` and `--local`↔`--repo`.

git / colocated store:

```bash
git config --global pr.vcs jj         # or: git  (colocated only; else leave unset)
git config --global pr.mode stacked   # or: normal
git config --global pr.draft true     # drafts on by default
git config --global --unset pr.draft  # drafts off (back to the default)
git config --global --unset pr.mode   # clear -> fall back to default / other scope
```

native jj store:

```bash
jj config set --user pr.vcs jj        # or: --repo for this repo only
jj config set --user pr.mode stacked
jj config set --user pr.draft true
jj config unset --user pr.draft       # clear a key
```

> A repo-scoped value always wins over a user-scoped one. If you set
> `stacked` globally but want one repo to stay `normal`, set it at the
> narrower scope in that repo (`git config --local pr.mode normal`, or
> `jj config set --repo pr.mode normal`). The same precedence applies to
> `pr.vcs` and `pr.draft`.

### 4. Confirm + point at stacked tooling

Re-read and report the active settings from the matching store (reuse
`$HAS_GIT` from step 1):

```bash
if [ "$HAS_GIT" = 1 ]; then
  echo "mode:  $(git config pr.mode 2>/dev/null || echo 'normal (default)')"
  echo "draft: $([ "$(git config pr.draft 2>/dev/null)" = true ] && echo 'on' || echo 'off')"
else
  echo "mode:  $(jj config get pr.mode 2>/dev/null || echo 'normal (default)')"
  echo "draft: $([ "$(jj config get pr.draft 2>/dev/null)" = true ] && echo 'on' || echo 'off')"
fi
```

If the user switched **to stacked mode** on the **git** path, check for
the `git stack` CLI and recommend it:

```bash
git stack --version 2>/dev/null && echo "git stack: installed" \
  || echo "git stack: not installed (falls back to gh + git)"
```

If it's missing, tell them stacked mode still works via `gh` + `git`, but
`submit` (whole-stack push) needs `git stack` — install it from
<https://github.com/zcaceres/git-stack/releases>. The **jj** path needs
no such tool: its commit graph is the stack, so `submit` works out of the
box.

If the user turned the **draft default on**, remind them it applies to
PRs `/pr` creates from now on; an existing PR is unaffected until you
explicitly flip it (`gh pr ready --undo` to draft, `gh pr ready` to mark
ready), and a single run can still opt out with `--ready`/`--no-draft`.

### 5. Wire and provision the nudge hook

`/pr` bundles a diff-size nudge hook (see [nudge.md](nudge.md)) that nudges you
toward a focused PR once the uncommitted diff grows large. Two things must be in
place for it to fire on every edit: the hook has to be **wired** into the host's
`settings.json`, and the small prebuilt **binary** it execs has to be
provisioned (a file-copy install — `npx skills add`, a sparse checkout — ships
the source but **not** the ~60 MB binary). Until both are done the hook silently
no-ops.

`install.sh` does both — it wires the hook *and* runs `fetch-binary.sh` — and
it's idempotent, so it's safe to run on every `/pr setup`. Run the `install.sh`
that ships in this skill's `scripts/` directory (it self-locates, so any install
scope works), passing `--agent` for **the host you are running in right now**:

- **Claude Code** → `--agent claude` (wires a `PostToolUse` hook into `~/.claude/settings.json`)
- **Gemini CLI** → `--agent gemini` (wires an `AfterTool` hook into `~/.gemini/settings.json`)

You *are* the host executing this command, so pass the matching flag explicitly
rather than leaning on auto-detection — it can't tell the hosts apart when both
`~/.claude` and `~/.gemini` exist and defaults to Claude Code. If you genuinely
can't tell which host you are, ask the user.

```bash
# From the pr skill's scripts/ dir (e.g. ~/.claude/skills/pr/scripts):
./install.sh --agent claude    # Claude Code
# or
./install.sh --agent gemini    # Gemini CLI
```

`install.sh` needs `jq`, backs up the settings file with a timestamp before
editing it, and downloads the prebuilt binary from the skill's GitHub release
(needs `gh`) or builds it with `bun`. Add `--project` to wire into the
repo-local `./.claude` / `./.gemini` settings instead of user scope. Re-run it
if you ever see a "binary not found" note in your hook logs.

## Important

- This subcommand reads and writes `pr.vcs`, `pr.mode`, and `pr.draft`,
  and wires + provisions the nudge hook (step 5, via `install.sh` — which
  edits the host's `settings.json`, backing it up first). It never
  commits, pushes, or opens PRs.
- The store depends on the repo: `git config` for git/colocated,
  `jj config` for native jj. The user can also set the keys by hand —
  `git config [--global] pr.vcs jj` / `pr.mode <normal|stacked>` /
  `pr.draft true`, or the `jj config set [--user] pr.<key> <value>`
  equivalent.
- Any `pr.vcs` other than `jj` (including unset) resolves to **git** once
  the structural probe allows it. Any `pr.mode` other than `stacked`
  (including unset) is treated as `normal`. Any `pr.draft` other than
  `true` (including unset) is treated as **ready** (drafts off).
