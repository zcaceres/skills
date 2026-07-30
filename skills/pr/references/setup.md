# `/pr setup` — Persistent `/pr` Settings

Show and change the persistent `/pr` settings, all stored in git
config (a local value always overrides a global one):

- **draft default** (`pr.draft`) — when `true`, every PR this skill
  **creates** is opened as a draft unless the invocation passes
  `--ready`/`--no-draft`.
- **backend** (`pr.backend`) — `git` (default) or `jj`. On `jj`, workflow
  subcommands read `references/jj.md` and drive the repo with Jujutsu
  (colocated with git) instead of `git`/`git stack`. Written **local scope
  only** — see "Switch the backend" below.

The draft default affects PR creation only; a per-invocation
`--draft`/`-d` or `--ready`/`--no-draft` always overrides it for that
run.

## What the user asked to change

`/pr setup` manages two settings. Figure out which the invocation
targets, then only touch that one:

- Draft words → `draft`, `--draft`, `draft on` (turn on); `no-draft`,
  `--no-draft`, `ready`, `draft off` (turn off) (e.g. `/pr setup draft`).
- Backend words → `jj`, `git` (e.g. `/pr setup jj`).
- Several in one go is fine: `/pr setup jj draft`.
- No setting word → show everything (step 1) and ask which to change.

A `--global` / `--local` token sets the scope for whatever is written
(default **global**). **Exception:** the backend is always written
local — a global `jj` value would misroute every non-jj repo on the
machine, and per-repo `.jj/` auto-detection already gives the
"everywhere" behavior. Ignore `--global` for the backend and say so.

## Workflow

### 1. Show the current settings

```bash
echo "draft  local:  $(git config --local pr.draft  2>/dev/null || echo '(unset)')"
echo "draft  global: $(git config --global pr.draft 2>/dev/null || echo '(unset)')"
echo "draft  active: $([ "$(git config pr.draft 2>/dev/null)" = true ] && echo 'on (drafts by default)' || echo 'off (ready by default)')"
echo "backend local:  $(git config --local pr.backend 2>/dev/null || echo '(unset)')"
echo "backend active: $(git config pr.backend 2>/dev/null || { [ -d "$(git rev-parse --show-toplevel)/.jj" ] && echo 'jj (auto-detected .jj/)' || echo 'git (default)'; })"
```

`git config <key>` resolves the local value first, then the global one.
If `pr.draft` is unset (or not `true`) new PRs default to **ready**.

### 2. Ask the user what they want

If the invocation already made it clear (e.g. `/pr setup draft`,
`/pr setup jj`, `/pr setup no-draft`), skip the question and go straight
to step 3. Otherwise ask which setting(s) to change:

- Drafts by default? `on` or `off`.
- Backend? `git` or `jj` (jj is per-repo and colocates with git).
- Scope? **global** (applies to every repo on this machine — the right
  choice if you always work this way) or **local** (this repo only; the
  backend is always local).

Default to **global** scope unless the user asks for local — most people
want one consistent setup everywhere.

### 3. Write the setting(s)

Only write the keys the user is changing. Global is the recommended
default; pass `--local` to scope to this repo.

Draft default:

```bash
git config --global pr.draft true     # drafts on by default
git config --global --unset pr.draft  # drafts off (back to the default)
```

> A local value always wins over a global one. If you set `pr.draft
> true` globally but want one repo to stay ready-by-default, set
> `git config --local pr.draft false` in that repo.

Backend — `/pr setup jj` also bootstraps colocation, so it's a small
workflow rather than a single write:

```bash
# /pr setup jj
jj --version \
  || { echo "Install jj first: https://docs.jj-vcs.dev/latest/install-and-setup/"; exit 1; }
[ -d "$(git rev-parse --show-toplevel)/.jj" ] || jj git init --colocate
git config --local pr.backend jj
```

`jj git init --colocate` is additive — it creates `.jj/` alongside the
existing `.git` and touches no history; deleting `.jj/` undoes it.

```bash
# /pr setup git
if [ -d "$(git rev-parse --show-toplevel)/.jj" ]; then
  git config --local pr.backend git   # explicit: overrides .jj/ auto-detect
else
  git config --local --unset pr.backend
fi
```

The explicit `git` value matters when `.jj/` exists: an unset key would
auto-detect straight back to jj.

### 4. Confirm + point at stacked tooling

Re-read and report the active settings:

```bash
echo "draft:   $([ "$(git config pr.draft 2>/dev/null)" = true ] && echo 'on' || echo 'off')"
echo "backend: $(git config pr.backend 2>/dev/null || { [ -d "$(git rev-parse --show-toplevel)/.jj" ] && echo 'jj (auto-detected .jj/)' || echo 'git (default)'; })"
```

When the active backend is **jj**, report `jj --version` and skip the
`git stack` recommendation below — the jj path needs no extra binary.

On the **git backend**, check for the `git stack` CLI and recommend it:

```bash
git stack --version 2>/dev/null && echo "git stack: installed" \
  || echo "git stack: not installed (falls back to gh + git)"
```

If it's missing, tell them `/pr` still works via `gh` + `git`, but
`submit` (whole-stack push) needs `git stack` — install it from
<https://github.com/zcaceres/git-stack/releases>.

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

- This subcommand reads and writes `git config pr.draft` and
  `git config pr.backend` (plus `jj git init --colocate` when switching
  to jj), and wires + provisions the nudge hook (step 5, via
  `install.sh` — which edits the host's `settings.json`, backing it up
  first). It never commits, pushes, or opens PRs.
- All keys are plain git config — the user can also set them by hand
  with `git config [--global] pr.draft true` or
  `git config --local pr.backend <git|jj>`.
- Any `pr.draft` other than `true` (including unset) is treated
  as **ready** (drafts off). Any `pr.backend` other than `jj` is treated
  as `git` — except that an unset key in a repo with `.jj/` auto-detects
  to jj (see [SKILL.md → Determine the backend first](../SKILL.md)).
