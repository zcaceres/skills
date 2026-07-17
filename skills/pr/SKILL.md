---
name: pr
description: One skill for committing work and opening PRs. Two modes — normal (default) commits your conversation changes, pushes, and opens a single PR against the trunk; stacked turns the same command into a stacked-PR workflow (checkpoint slices, submit, sync, bottom-up merge). Toggle with /pr setup. Any PR can be opened as a draft with --draft (-d), or make drafts the default with /pr setup. Also ships a diff-size nudge hook toward /pr when the uncommitted diff grows large. Agent-callable — an agent working through a task should invoke this to ship a finished slice — `checkpoint`/`commit` at each logical seam to land a stacked PR and continue on a fresh branch, or `update` to commit and open/refresh a single PR. Reach for it when a unit of work is complete or the user asks to commit, push, checkpoint, or open a PR. Do not autonomously run `merge` (it lands PRs into trunk) unless the user asks. Runs under both Claude Code and Gemini CLI (install with --agent gemini). Drives git or jj (jujutsu) — pick with /pr setup jj; git is the default, and colocated repos default to git. On git it uses git stack when installed and falls back to gh + git; on jj the commit graph is the stack, no extra tooling. Invoke via /pr [subcommand] [args].
argument-hint: "[commit | setup | update | log | merge | checkpoint | submit | sync] [--draft] [args]"
hooks:
  PostToolUse:
    - matcher: "Edit|Write|MultiEdit|NotebookEdit"
      type: command
      command: "${CLAUDE_SKILL_DIR}/scripts/run.sh"
  AfterTool:
    - matcher: "replace|write_file"
      type: command
      command: "${CLAUDE_SKILL_DIR}/scripts/run.sh"
---

# PR — One Skill

Commit your work and open a pull request with `/pr`. The skill has two
modes:

- **normal** (default) — commit the changes you made in this conversation,
  push, and open a single PR against the trunk (`main`/`master`). This is
  the everyday "ship my work" flow.
- **stacked** — the same command becomes a stacked-PR workflow: each `/pr`
  slices the current diff onto a new branch stacked on the last one, plus
  subcommands to push the whole stack, rebase onto trunk, and merge
  bottom-up.

Normal mode is the default. Stacked mode is opt-in — see
[`/pr setup`](references/setup.md).

Independently of the mode, any PR this skill **creates** can be a
**draft**: pass `--draft` (or `-d`) on the invocation, or make drafts the
default everywhere with [`/pr setup`](references/setup.md) (writes
`git config pr.draft true`). Draft and mode are orthogonal — drafts work
in both normal and stacked flows.

**Usage:** `/pr [subcommand] [args]`

`$ARGUMENTS` is parsed by the dispatcher below. Read the matched
subcommand's reference file and follow it exactly.

## Determine the VCS first

This resolves **before** the mode and draft settings, because it decides
which config store those settings live in. It picks whether this run
drives **git** or **jj** (jujutsu), and every workflow reference has a
git and a jj copy under `references/<vcs>/`.

**Detection is structural; config is only a tiebreaker.** Probe the
filesystem first, then consult `pr.vcs` only when the answer is genuinely
ambiguous (a colocated repo):

```bash
git rev-parse --show-toplevel >/dev/null 2>&1 && HAS_GIT=1 || HAS_GIT=0
jj root                       >/dev/null 2>&1 && HAS_JJ=1  || HAS_JJ=0
```

| `HAS_GIT` | `HAS_JJ` | Resolved VCS |
|---|---|---|
| 1 | 0 | **git** |
| 1 | 1 | colocated → read `pr.vcs`; **git** unless it says `jj` |
| 0 | 1 | **jj** (native) |
| 0 | 0 | not a repo → stop, tell the user |

Only the colocated row reads config, and there `.git` exists, so
`git config pr.vcs` is always readable — no bootstrap problem.

**The resolved VCS selects the config store** for `pr.mode`, `pr.draft`,
and `pr.vcs` itself:

- **git** (or colocated) → `git config` (local overrides global) —
  unchanged from before.
- **native jj** → `jj config get <key>` (repo overrides user); `get`
  exits non-zero when a key is unset, so wrap reads in
  `|| echo` and treat a failure as unset.

Carry the resolved VCS (`git` or `jj`) into every step below: the mode
and draft reads use its store, and the dispatcher reads
`references/<vcs>/<cmd>.md` — both the `git/` and `jj/` recipe sets ship
with this skill.

## Determine the mode first

Before dispatching, read the active mode from the resolved VCS's config
store (see above):

```bash
git config pr.mode 2>/dev/null              # git / colocated
jj config get pr.mode 2>/dev/null || true   # native jj
# resolves repo/local, then user/global; empty = unset
```

- Output `stacked` → **stacked mode**.
- Output `normal`, empty, or anything else → **normal mode** (the default).

Mode only changes what the **default** action (bare `/pr` or a
description with no subcommand) does. Every *named* subcommand works in
either mode — the user asked for it by name, so honor it.

## Determine draft intent

Resolve, once, whether a PR you **create** this run should be a draft.
Per-invocation flags always win over the configured default:

1. The dispatcher strips draft flags from `$ARGUMENTS` before matching a
   subcommand (see below). If `--ready`/`--no-draft` was present →
   **ready**. Else if `--draft`/`-d` was present → **draft**. If both
   appear, the **last** one on the line wins.
2. No per-invocation flag → read the default from the resolved VCS's
   config store (see "Determine the VCS first"):

   ```bash
   git config pr.draft 2>/dev/null              # git / colocated
   jj config get pr.draft 2>/dev/null || true   # native jj
   ```

   Output `true` → **draft**. Anything else (including empty) → **ready**.

Carry the resolved answer (**draft** or **ready**) into the matched
subcommand. It only affects PR **creation** — `gh pr create` gets
`--draft` (or `git stack submit` gets `--draft`) when the answer is
draft. An explicit per-invocation flag may also flip an *already-open* PR
(`gh pr ready` / `gh pr ready --undo`); the configured default never does
— see [update.md](references/git/update.md).

## Subcommands

| Subcommand | Reference | What it does |
|---|---|---|
| `commit [message]` | (alias) | Run the **default action** for the active mode — `update` in normal mode, `checkpoint` in stacked mode. The everyday "ship my work" verb; identical to bare `/pr`. |
| `setup` | [references/setup.md](references/setup.md) | Show and change the persistent settings: the VCS (`git` ↔ `jj`, `pr.vcs`), the mode (`normal` ↔ `stacked`, `pr.mode`) and the draft default (`pr.draft`). Global by default. |
| `update [base-branch]` | `references/<vcs>/update.md` | Commit + push + update the current branch's PR (or open one if missing). Doesn't change an existing PR's base. **This is the normal-mode default.** |
| `log` | `references/<vcs>/log.md` | Read-only. In stacked mode print the stack tree; in normal mode list the current branch's PR (falls back to `gh pr list`). |
| `merge [--merge\|--rebase\|--squash] [--all] [--dry-run]` | `references/<vcs>/merge.md` | In normal mode merge the current branch's single PR. In stacked mode land the stack bottom-up with retarget verification. |
| `checkpoint [slice description]` | `references/<vcs>/checkpoint.md` | Cut the current uncommitted diff as the next branch in a stack. Local only on the git-stack and jj paths — it doesn't publish; you build the stack with repeated checkpoints, then `submit`. (The `gh`-fallback path still publishes eagerly.) **This is the stacked-mode default.** |
| `submit [--draft]` | `references/<vcs>/submit.md` | **Publish point.** Push the whole stack, open/update one PR per branch, and stamp the `[<name> N/M]` title markers — so the finished stack lands on GitHub at once. `--draft` opens the created PRs as drafts. The git path requires `git stack`; the jj path needs no extra tooling. |
| `sync [--no-push]` | `references/<vcs>/sync.md` | Fetch trunk and rebase every branch in the stack onto the updated tip. Stacked workflow. |

Where a Reference cell shows `references/<vcs>/…`, substitute the VCS
resolved in "Determine the VCS first" (`git` or `jj`).

## Stacked-PR title markers

When a stack is published, each PR's title is prefixed with a
`[<name> N/M]` marker (e.g. `[ENG-456 2/4] Add token middleware`) so it's
obvious in GitHub that the PR belongs to a stack and where it sits.
`<name>` is the ticket identifier the work is tracked under (e.g.
`ENG-456`) when the branch carries one, else a slug derived from the
bottom branch; `N/M` is the position from the bottom over the total.
`submit` stamps the markers at publish time; `merge` deliberately leaves
them alone. See
[references/title-convention.md](references/title-convention.md) for the
format and the renumber routine.

## Bundled hook

A diff-size nudge hook is shipped with this skill. It fires after every
file-modifying tool call and nudges toward `/pr` when the uncommitted
diff crosses size/file thresholds — so you land a focused PR (a stacked
checkpoint in stacked mode) before the diff grows unwieldy. The same hook
binary runs under **Claude Code** (`PostToolUse`;
`Edit`/`Write`/`MultiEdit`/`NotebookEdit`) and **Gemini CLI**
(`AfterTool`; `replace`/`write_file`) — it reads the host's event name
from the hook payload and adapts. Only the settings wiring differs, and
`install.sh --agent` handles that.

Two-step install:

```sh
npx skills add zcaceres/skills -s pr
~/.claude/skills/pr/scripts/install.sh                 # Claude Code (default)
# or, for Gemini CLI:
~/.gemini/skills/pr/scripts/install.sh --agent gemini
```

The second step wires the hook into the host's `settings.json` so it
fires on every matching tool call, not just when the skill is active in
context (`${CLAUDE_SKILL_DIR}` substitution in frontmatter hook commands
is unsupported by both hosts today). `install.sh` auto-detects the host
(override with `--agent claude|gemini`) and writes the right event name,
tool matcher, and settings dir (`~/.claude` vs `~/.gemini`). The script
self-locates, so the same command works whether the skill was installed
at user scope or project scope. Flags: `--agent`, `--project`,
`--target PATH`. Requires `jq`. See [references/nudge.md](references/nudge.md)
for thresholds, env-var overrides, and manual wiring as an alternative.

`install.sh` also provisions the compiled binary the hook execs (a
file-copy install ships the source but not the ~60 MB binary) by
running `scripts/fetch-binary.sh` — which downloads the prebuilt binary
for your platform from the skill's GitHub release, or builds it with
`bun`. `/pr setup` runs `install.sh` for you — inferring `--agent` from
the host it's running in — so configuring the skill both wires the hook
and leaves it fully functional. See [references/nudge.md](references/nudge.md#provisioning-the-binary).

## Dispatcher

First resolve the VCS (see "Determine the VCS first"), then read the mode
(see "Determine the mode first"). The VCS picks which
`references/<vcs>/` directory the workflow subcommands read from.

**`setup` is exempt from the next step.** If the first non-flag token of
`$ARGUMENTS` is `setup`, skip draft-flag stripping and dispatch straight
to [setup.md](references/setup.md) with the raw `$ARGUMENTS` — there,
`draft`/`--draft`/`no-draft`/`ready` mean "which default to write", not
per-run intent.

Otherwise, **extract draft flags** from `$ARGUMENTS` wherever they appear
and remove them from the token stream, recording the draft intent (see
"Determine draft intent" above):

- `--draft` / `-d` → draft.
- `--ready` / `--no-draft` → ready (overrides a `pr.draft true` default).

These are not subcommands and never consume the subcommand slot —
`/pr --draft`, `/pr update --draft`, and `/pr -d "fix bug"` all dispatch
to the default/named action with draft intent set. After stripping them,
parse the first remaining whitespace-separated token of `$ARGUMENTS`:

1. **First token is `setup`** → read [references/setup.md](references/setup.md)
   and follow it. This is how the user switches modes.

2. **First token is `update`, `log`, or `merge`** → read
   `references/<vcs>/<keyword>.md`, then follow its workflow with the
   remaining `$ARGUMENTS` as that subcommand's arguments. These work in
   both modes; each reference has a mode-specific path.

3. **First token is `checkpoint`, `submit`, or `sync`** (stacked
   operations) → read `references/<vcs>/<keyword>.md` and follow it with
   the remaining `$ARGUMENTS`. These run regardless of mode — an explicit
   keyword is explicit intent. If the mode is not `stacked`, add a
   one-line note: "(You're in normal mode — `/pr setup` makes `/pr`
   default to stacked operations.)"

4. **First remaining token starts with `-`** (e.g. `--help`, `-h`) →
   print this subcommand list and stop. (Draft flags were already
   stripped in the pre-parse step, so they never land here.)

5. **First token is `commit`, anything else, OR `$ARGUMENTS` is empty** →
   this is the **default action**, which depends on the mode:

   - **normal mode** → read `references/<vcs>/update.md` and follow it.
     This commits your conversation changes, pushes, and opens (or
     updates) a single PR against the trunk.

   - **stacked mode** → read `references/<vcs>/checkpoint.md` and follow
     it, using the message as the slice description.

   `commit` is an explicit, mode-aware alias for this default action — it
   is **not** hard-wired to `checkpoint`, so it never forces stacked
   behavior on a normal-mode user. When the first token is literally
   `commit`, strip it and pass the *remaining* `$ARGUMENTS` as the commit
   message / slice description. For any other non-keyword first token, the
   *full* `$ARGUMENTS` string seeds the commit message / PR title.

   So in normal mode `/pr` ≡ `/pr commit` ≡ `/pr update`, and in stacked
   mode `/pr` ≡ `/pr commit` ≡ `/pr checkpoint` — no need to type the
   keyword for the everyday action.

If the agent is unsure which mode the user wants — e.g. the first token
is ambiguous between a subcommand and a description — ask the user before
acting. Don't guess at workflow-changing inputs.

## Important — applies to every subcommand

- NEVER commit files you didn't modify in this conversation.
- NEVER let a file you didn't touch ride along in a slice. On **git**,
  stage explicitly — never `git add .` / `git add -A`. On **jj**
  (which auto-tracks the whole working copy into `@`), carve the slice
  with `jj split <explicit paths>`, never a bare `jj commit` that sweeps
  everything.
- Report the PR URL when done.
- **When an agent invokes this itself** (not a direct `/pr` from the
  user): `checkpoint`, `commit`, `update`, and `submit` are fair game at a
  logical seam — that's the point of being agent-callable. But `merge`
  lands PRs into trunk and is irreversible; run it only when the user
  explicitly asks. Never invoke `setup` (it flips the user's mode) on your
  own.
- Prefer the VCS's native stack primitives over hand-rolled `gh` loops:
  on **git**, `git stack` when it's installed and the branch is stacked;
  on **jj**, the commit graph itself (`jj log`/`jj rebase`) — no external
  tool needed.
