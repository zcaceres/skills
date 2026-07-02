# `/pr setup` — Choose Normal or Stacked Mode

Show the current `/pr` mode and switch between **normal** (default) and
**stacked**. The mode is stored in `git config pr.mode` and controls only
what the bare `/pr` (default) action does:

- **normal** → `/pr` commits your conversation changes, pushes, and opens
  a single PR against the trunk (see [update.md](update.md)).
- **stacked** → `/pr` cuts the current diff as the next branch in a stack
  and opens a PR against its parent (see [checkpoint.md](checkpoint.md)).

Named subcommands (`update`, `log`, `merge`, `checkpoint`, `submit`,
`sync`) work in either mode regardless of this setting.

## Workflow

### 1. Show the current mode

```bash
echo "local:  $(git config --local pr.mode 2>/dev/null || echo '(unset)')"
echo "global: $(git config --global pr.mode 2>/dev/null || echo '(unset)')"
echo "active: $(git config pr.mode 2>/dev/null || echo 'normal (default)')"
```

`git config pr.mode` resolves the local value first, then the global one.
If neither is set, the active mode is **normal**.

### 2. Ask the user what they want

If the user's invocation already made it clear (e.g. `/pr setup stacked`,
`/pr setup normal`, `/pr setup --global stacked`), skip the question and
go straight to step 3. Otherwise ask:

- Which mode? `normal` or `stacked`.
- Scope? **global** (applies to every repo on this machine — the right
  choice if you always work this way) or **local** (this repo only).

Default to **global** scope unless the user asks for local — most people
want one consistent mode everywhere.

### 3. Write the setting

Global (recommended default):

```bash
git config --global pr.mode stacked   # or: normal
```

Local (this repo only):

```bash
git config --local pr.mode stacked    # or: normal
```

To clear a setting and fall back to the default / the other scope:

```bash
git config --global --unset pr.mode   # or --local
```

> A local value always wins over a global one. If you set `stacked`
> globally but want one repo to stay `normal`, set `git config --local
> pr.mode normal` in that repo.

### 4. Confirm + point at stacked tooling

Re-read and report the active mode:

```bash
git config pr.mode 2>/dev/null || echo 'normal (default)'
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

- This subcommand reads and writes `git config pr.mode`, and wires + provisions
  the nudge hook (step 5, via `install.sh` — which edits the host's
  `settings.json`, backing it up first). It never commits, pushes, or opens PRs.
- `pr.mode` is plain git config — the user can also set it by hand with
  `git config [--global] pr.mode <normal|stacked>`.
- Any value other than `stacked` (including unset) is treated as
  `normal`.
