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

### 5. Provision the nudge hook binary

`/pr` bundles a PostToolUse hook (see [nudge.md](nudge.md)) that nudges you
toward a focused PR once the uncommitted diff grows large. The hook execs a
small prebuilt binary that a file-copy install (`npx skills add`, a sparse
checkout) ships the source for but **not** the binary itself — so until it's
provisioned the hook silently no-ops. Run the provisioner once from the `pr`
skill's `scripts/` directory (e.g. `~/.claude/skills/pr/scripts`):

```bash
./fetch-binary.sh
```

It downloads the prebuilt binary for your platform from the skill's GitHub
release (needs `gh`), or builds it with `bun` if no release asset is
available. It's idempotent — a no-op once the binary is present, so it's safe
to run on every `/pr setup`. Re-run it if you ever see a "binary not found"
note in your hook logs.

## Important

- This subcommand reads and writes `git config pr.mode` and provisions the
  nudge hook binary (step 5). It never commits, pushes, or opens PRs.
- `pr.mode` is plain git config — the user can also set it by hand with
  `git config [--global] pr.mode <normal|stacked>`.
- Any value other than `stacked` (including unset) is treated as
  `normal`.
