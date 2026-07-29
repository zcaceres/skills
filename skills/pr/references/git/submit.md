# `/pr submit` — Publish the Whole Stack

**This is the publish point for a stack.** Checkpoints are built locally
and unpublished (see [`/pr checkpoint`](checkpoint.md)); `submit` is what
pushes every branch (force-with-lease), opens one GitHub PR per branch
(each targeting the branch below it), and stamps the `[<name> N/M]` title
markers — so the finished stack reaches GitHub as one coherent set rather
than a trickle of partial PRs. Idempotent — safe to re-run after rebases
or after adding more checkpoints.

Wrapper around `git stack submit` plus a title-marker pass. There is no
clean `gh`-only equivalent for "publish the whole stack at once" — when
`git stack` isn't installed, checkpoints publish eagerly and `/pr update`
is the single-branch path.

## Flags (passed through `$ARGUMENTS`)

- `--draft` — open the stack's PRs as **drafts**. Passes `--draft` through
  to `git stack submit`, so every PR this run *creates* starts in draft
  state. Existing PRs are left as-is (matches `git stack` / `gh pr create`
  semantics — `--draft` only affects newly-created PRs; it will not convert
  an already-open PR back to draft). This is also implied when
  `git config pr.draft true` is configured (see
  [SKILL.md → Determine draft intent](../../SKILL.md#determine-draft-intent)),
  unless overridden by `--ready`/`--no-draft` on the invocation.

## Workflow

### 1. Verify You're In a Stack

```bash
CURRENT=$(git branch --show-current)
git config "branch.$CURRENT.stack-parent" 2>/dev/null
```

If this prints nothing, the current branch isn't a recorded stack
member. Tell the user:

> "`<branch>` isn't part of a tracked stack — there's nothing for
> `/pr submit` to push as a group. Use `/pr update` for
> a single-branch push, or `/pr checkpoint` to start a new
> stack from this branch."

Stop here.

### 2. Confirm `git stack` Is Installed

```bash
git stack --version 2>/dev/null
```

If this fails, the user doesn't have `git stack`. Tell them:

> "`git stack` isn't installed, and there's no safe `gh`-only
> equivalent for submitting a whole stack at once. Either install it
> from <https://github.com/zcaceres/git-stack/releases>, or push each
> branch individually with `/pr update` while checked out on
> it."

Stop here. Don't try to fake the multi-branch push with a `gh` loop —
the failure modes (missing retargeting, partial pushes, force-pushing
the wrong branch) make it riskier than asking the user to install the
tool.

### 3. Pre-flight: Fetch + Show the Stack

```bash
git fetch
git stack log
```

Show the user the stack and its current PR state. If any branch has
unpushed remote drift (e.g. a teammate pushed to it), pause and ask
how to reconcile before force-with-lease overwrites their work.

### 4. Submit

Resolve draft intent (**draft** or **ready**) per
[SKILL.md → Determine draft intent](../../SKILL.md#determine-draft-intent) —
that resolves an explicit `--draft`/`-d` or `--ready`/`--no-draft` on the
invocation, falling back to the `pr.draft` default. Pass `--draft` to
`git stack submit` whenever the intent is **draft** (which includes the
configured default); use plain `git stack submit` otherwise:

```bash
git stack submit            # draft intent is ready
git stack submit --draft    # draft intent is draft (flag or pr.draft default)
```

This:

- Pushes each branch in the stack with `--force-with-lease`.
- Creates a PR for any branch that doesn't have one, with `--base`
  set to the parent branch — as a **draft** when `--draft` was passed.
- Updates the title/body of existing PRs (per `git stack` defaults).
  `--draft` only affects newly-created PRs; it does not convert an
  already-open PR back to draft.

### 5. Renumber Stack Title Markers

Run the renumber routine from
[references/title-convention.md](../title-convention.md) so every PR's title
carries its `[<name> N/M]` marker. This runs *after* `git stack submit`,
so it overrides whatever titles git-stack set and keeps the position
labels (`N/M`) accurate for the current stack size.

### 6. Report

Print one line per PR with the title (marker included), URL, and base,
e.g.:

```
#42  [auth 1/3] Add token model        base: main          (bottom)  https://github.com/…/pull/42
#43  [auth 2/3] Add token middleware    base: feat/layer-1            https://github.com/…/pull/43
#44  [auth 3/3] Wire into the router    base: feat/layer-2  (top)     https://github.com/…/pull/44
```

Recover URLs via `gh pr view <number> --json url,baseRefName -q '...'`
or by parsing `git stack log` output.

## Important

- Never run with `--no-verify` or similar — let pre-push hooks fire.
- If `git stack submit` errors mid-way (e.g. one PR creation fails),
  stop and surface the error. Don't retry blindly — partial state is
  recoverable, blind retries can amplify mistakes.
- Don't rewrite or amend commits inside this subcommand. Use
  `/pr update` or `/pr sync` for those workflows.
