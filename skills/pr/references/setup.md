# `/pr setup` — Persistent `/pr` Settings

Show and change the two persistent `/pr` settings, both stored in git
config (a local value always overrides a global one):

- **mode** (`pr.mode`) — switch between **normal** (default) and
  **stacked**. Controls only what the bare `/pr` (default) action does:
  - **normal** → `/pr` commits your conversation changes, pushes, and
    opens a single PR against the trunk (see [update.md](git/update.md)).
  - **stacked** → `/pr` cuts the current diff as the next branch in a
    stack and opens a PR against its parent (see [checkpoint.md](git/checkpoint.md)).
- **draft default** (`pr.draft`) — when `true`, every PR this skill
  **creates** is opened as a draft unless the invocation passes
  `--ready`/`--no-draft`. Orthogonal to the mode; applies to both flows.

Named subcommands (`update`, `log`, `merge`, `checkpoint`, `submit`,
`sync`) work in either mode regardless of these settings. The draft
default affects PR creation only; a per-invocation `--draft`/`-d` or
`--ready`/`--no-draft` always overrides it for that run.

## What the user asked to change

`/pr setup` manages both settings. Figure out which the invocation
targets, then only touch that one:

- Mode words → `normal`, `stacked` (e.g. `/pr setup stacked`).
- Draft words → `draft`, `--draft`, `draft on` (turn on); `no-draft`,
  `--no-draft`, `ready`, `draft off` (turn off) (e.g. `/pr setup draft`).
- Both in one go is fine: `/pr setup stacked draft`.
- No setting word → show everything (step 1) and ask which to change.

A `--global` / `--local` token sets the scope for whatever is written
(default **global**).

## Workflow

### 1. Show the current settings

```bash
echo "mode   local:  $(git config --local pr.mode  2>/dev/null || echo '(unset)')"
echo "mode   global: $(git config --global pr.mode 2>/dev/null || echo '(unset)')"
echo "mode   active: $(git config pr.mode 2>/dev/null || echo 'normal (default)')"
echo "draft  local:  $(git config --local pr.draft  2>/dev/null || echo '(unset)')"
echo "draft  global: $(git config --global pr.draft 2>/dev/null || echo '(unset)')"
echo "draft  active: $([ "$(git config pr.draft 2>/dev/null)" = true ] && echo 'on (drafts by default)' || echo 'off (ready by default)')"
```

`git config <key>` resolves the local value first, then the global one.
If `pr.mode` is unset the active mode is **normal**; if `pr.draft` is
unset (or not `true`) new PRs default to **ready**.

### 2. Ask the user what they want

If the invocation already made it clear (e.g. `/pr setup stacked`,
`/pr setup draft`, `/pr setup --global stacked`, `/pr setup no-draft`),
skip the question and go straight to step 3. Otherwise ask which
setting(s) to change:

- Mode? `normal` or `stacked`.
- Drafts by default? `on` or `off`.
- Scope? **global** (applies to every repo on this machine — the right
  choice if you always work this way) or **local** (this repo only).

Default to **global** scope unless the user asks for local — most people
want one consistent setup everywhere.

### 3. Write the setting(s)

Only write the keys the user is changing. Global is the recommended
default; pass `--local` to scope to this repo.

Mode:

```bash
git config --global pr.mode stacked   # or: normal
```

Draft default:

```bash
git config --global pr.draft true     # drafts on by default
git config --global --unset pr.draft  # drafts off (back to the default)
```

To clear a setting and fall back to the default / the other scope:

```bash
git config --global --unset pr.mode   # or --local; same for pr.draft
```

> A local value always wins over a global one. If you set `stacked`
> globally but want one repo to stay `normal`, set `git config --local
> pr.mode normal` in that repo. The same precedence applies to
> `pr.draft`.

### 4. Confirm + point at stacked tooling

Re-read and report the active settings:

```bash
echo "mode:  $(git config pr.mode 2>/dev/null || echo 'normal (default)')"
echo "draft: $([ "$(git config pr.draft 2>/dev/null)" = true ] && echo 'on' || echo 'off')"
```

If the user switched **to stacked mode**, check for the `git stack` CLI
and recommend it:

```bash
git stack --version 2>/dev/null && echo "git stack: installed" \
  || echo "git stack: not installed (falls back to gh + git)"
```

If it's missing, tell them stacked mode still works via `gh` + `git`, but
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

- This subcommand reads and writes `git config pr.mode` and
  `git config pr.draft`, and wires + provisions the nudge hook (step 5, via
  `install.sh` — which edits the host's `settings.json`, backing it up
  first). It never commits, pushes, or opens PRs.
- Both keys are plain git config — the user can also set them by hand
  with `git config [--global] pr.mode <normal|stacked>` or
  `git config [--global] pr.draft true`.
- Any `pr.mode` other than `stacked` (including unset) is treated as
  `normal`. Any `pr.draft` other than `true` (including unset) is treated
  as **ready** (drafts off).
