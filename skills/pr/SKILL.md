---
name: pr
description: One skill for committing work and opening PRs, built around stacked PRs. Bare /pr checkpoints the current diff as the next branch in a stack; subcommands publish the stack (submit), rebase it onto trunk (sync), walk every PR as annotatable Markdown plus exact patches (walk), and land it bottom-up (merge). /pr update covers the single-branch case — commit and refresh the current branch's PR. Any PR can be opened as a draft with --draft (-d), or make drafts the default with /pr setup. Also ships a diff-size nudge hook toward /pr when the uncommitted diff grows large. Agent-callable — an agent working through a task should invoke this to ship a finished slice — `checkpoint`/`commit` at each logical seam to land a stacked PR and continue on a fresh branch, or `update` to commit and refresh the current branch's single PR. Reach for it when a unit of work is complete or the user asks to commit, push, checkpoint, open a PR, or review/walk a PR stack. Do not autonomously run `merge` (it lands PRs into trunk) unless the user asks. Runs under both Claude Code and Gemini CLI (install with --agent gemini). Uses git stack when installed, falls back to gh + git. Optional Jujutsu (jj) backend for colocated repos (enable with /pr setup jj). Invoke via /pr [subcommand] [args].
argument-hint: "[commit | setup | update | log | walk | merge | checkpoint | submit | sync] [--draft] [args]"
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

Commit your work and ship it as stacked PRs with `/pr`. Each bare `/pr`
slices the current diff onto a new branch stacked on the last one;
subcommands push the whole stack (`submit`), rebase it onto trunk
(`sync`), review it as annotatable Markdown (`walk`), and merge it
bottom-up (`merge`). `/pr update` covers the single-branch case — commit
and refresh the current branch's PR.

Any PR this skill **creates** can be a **draft**: pass `--draft` (or
`-d`) on the invocation, or make drafts the default everywhere with
[`/pr setup`](references/setup.md) (writes `git config pr.draft true`).
Draft is orthogonal to everything else — it works on every subcommand
that creates a PR.

**Usage:** `/pr [subcommand] [args]`

`$ARGUMENTS` is parsed by the dispatcher below. Read the matched
subcommand's reference file and follow it exactly.

## Determine the backend first

Before anything else, resolve which VCS backend drives the workflow:

```bash
git config pr.backend 2>/dev/null   # resolves local, then global; empty = unset
```

- Output `jj` → **jj backend**.
- Empty AND `.jj/` exists at the repo root
  (`[ -d "$(git rev-parse --show-toplevel)/.jj" ]`) → **jj backend**
  (the user colocated by hand).
- Anything else — including an explicit `git` — → **git backend** (the
  default).

The backend only changes which workflow reference is read. The git backend
uses `references/git/<keyword>.md`; the jj backend uses the matching command
section in [`references/jj.md`](references/jj.md). `setup`, `walk`,
`title-convention.md`, and `recovery.md` are shared. Draft semantics are
identical in both backends. The jj backend is **colocated-only** (jj working
alongside `.git` in the same checkout) — [`/pr setup`](references/setup.md)
wires it with `/pr setup jj`.

## Determine draft intent

Resolve, once, whether a PR you **create** this run should be a draft.
Per-invocation flags always win over the configured default:

1. The dispatcher strips draft flags from `$ARGUMENTS` before matching a
   subcommand (see below). If `--ready`/`--no-draft` was present →
   **ready**. Else if `--draft`/`-d` was present → **draft**. If both
   appear, the **last** one on the line wins.
2. No per-invocation flag → read the default:

   ```bash
   git config pr.draft 2>/dev/null   # resolves local, then global
   ```

   Output `true` → **draft**. Anything else (including empty) → **ready**.

Carry the resolved answer (**draft** or **ready**) into the matched
subcommand. It only affects PR **creation** — `gh pr create` gets
`--draft` (or `git stack submit` gets `--draft`) when the answer is
draft. An explicit per-invocation flag may also flip an *already-open* PR
(`gh pr ready` / `gh pr ready --undo`); the configured default never does
— see the matched backend's `update` workflow.

## Subcommands

| Subcommand | Reference | What it does |
|---|---|---|
| `commit [message]` | (alias) | Alias for the **default action** — `checkpoint`, with the message as the slice description. The everyday "ship my work" verb; identical to bare `/pr`. |
| `setup` | [references/setup.md](references/setup.md) | Show and change the persistent settings: the draft default (`pr.draft`) and the backend (`pr.backend`, `git` ↔ `jj`). Global by default (the backend is always local-scope). |
| `update [base-branch]` | [git](references/git/update.md) · [jj](references/jj.md#update) | Commit + push + update the current branch's PR (or open one if missing). The single-branch flow; doesn't change an existing PR's base. |
| `log` | [git](references/git/log.md) · [jj](references/jj.md#log) | Read-only. Print the stack tree with each branch's PR status (a branch that isn't stacked renders as a one-branch stack). |
| `walk [PR-number-or-URL]` | [references/walk.md](references/walk.md) | Build numbered Markdown + exact-patch review artifacts with one notes area per open PR, render each complete PR in conversational mode with structured controls, collect notes bottom-to-top, then apply the approved stack-wide plan and sync it to GitHub. Use `--resume <session-dir>` to continue a packet. |
| `merge [--merge\|--rebase\|--squash] [--all] [--dry-run]` | [git](references/git/merge.md) · [jj](references/jj.md#merge) | Land the stack bottom-up with retarget verification (a lone branch is just a one-PR stack). |
| `checkpoint [slice description]` | [git](references/git/checkpoint.md) · [jj](references/jj.md#checkpoint) | Cut the current uncommitted diff as the next branch in a stack. On the git-stack path this is **local only** — it doesn't publish; you build the stack with repeated checkpoints, then `submit`. (The `gh`-fallback path still publishes eagerly.) **This is the default action.** |
| `submit [--draft]` | [git](references/git/submit.md) · [jj](references/jj.md#submit) | **Publish point.** Push the whole stack (force-with-lease), open/update one PR per branch, and stamp the `[<name> N/M]` title markers — so the finished stack lands on GitHub at once. `--draft` opens the created PRs as drafts. Requires `git stack` on the git backend; the jj backend needs no extra binary. |
| `sync [--no-push]` | [git](references/git/sync.md) · [jj](references/jj.md#sync) | Fetch trunk and rebase every branch in the stack onto the updated tip. |

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
checkpoint) before the diff grows unwieldy. The same hook
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

First read the backend (see "Determine the backend first" above). For a
workflow command, read `references/git/<keyword>.md` on the git backend or
the matching command section in `references/jj.md` on the jj backend.
`setup` and `walk` are always shared.

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
   and follow it. This is how the user changes the persistent settings.

2. **First token is `walk`** → read [references/walk.md](references/walk.md)
   and follow it with the remaining `$ARGUMENTS`. This workflow is shared
   across backends because it operates on published GitHub PRs.

3. **First token is `update`, `log`, `merge`, `checkpoint`, `submit`, or
   `sync`** → read the matched backend workflow described above, then
   follow it with the remaining `$ARGUMENTS` as that subcommand's
   arguments.

4. **First remaining token starts with `-`** (e.g. `--help`, `-h`) →
   print this subcommand list and stop. (Draft flags were already
   stripped in the pre-parse step, so they never land here.)

5. **First token is `commit`, anything else, OR `$ARGUMENTS` is empty** →
   the **default action**: read the matched backend's `checkpoint`
   workflow and follow it, using the message as the slice description.

   When the first token is literally `commit`, strip it and pass the
   *remaining* `$ARGUMENTS` as the slice description. For any other
   non-keyword first token, the *full* `$ARGUMENTS` string seeds the
   slice description.

   So `/pr` ≡ `/pr commit` ≡ `/pr checkpoint` — no need to type the
   keyword for the everyday action.

If the agent is unsure what the user wants — e.g. the first token is
ambiguous between a subcommand and a description — ask the user before
acting. Don't guess at workflow-changing inputs.

## Important — applies to every subcommand

- NEVER commit files you didn't modify in this conversation.
- NEVER use `git add .` or `git add -A`. Stage explicitly.
- Report the PR URL when done.
- **When an agent invokes this itself** (not a direct `/pr` from the
  user): `checkpoint`, `commit`, `update`, and `submit` are fair game at a
  logical seam — that's the point of being agent-callable. But `merge`
  lands PRs into trunk and is irreversible; run it only when the user
  explicitly asks. Never invoke `setup` (it flips the user's persistent
  settings) on your own.
- (git backend) If `git stack` is installed and the branch is stacked,
  prefer its primitives over hand-rolled `gh` loops.
- (jj backend) No extra binary is needed — jj itself is the stack
  primitive (ancestry replaces `stack-parent` config, one rebase
  restacks everything).
