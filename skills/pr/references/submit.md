# `/pr submit` — Push the Whole Stack

Push every branch in the current stack (force-with-lease) and
create/update one GitHub PR per branch, each targeting the branch
below it. Idempotent — safe to re-run after rebases.

Pure wrapper around `git stack submit`. There is no clean `gh`-only
equivalent for "push the whole stack at once" — `/pr update`
is the single-branch path when `git stack` isn't installed.

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

```bash
git stack submit
```

This:

- Pushes each branch in the stack with `--force-with-lease`.
- Creates a PR for any branch that doesn't have one, with `--base`
  set to the parent branch.
- Updates the title/body of existing PRs (per `git stack` defaults).

`git stack` owns the PR bodies. For every PR whose base is another stacked
branch (not the trunk at the bottom), confirm the body points reviewers at
its parent branch and add the **Stacked-on line** if it's missing — see
[checkpoint.md → "Stacked-on line"](checkpoint.md#stacked-on-line). Use
`gh pr edit <number> --body` for the top-up; a later `git stack submit` may
rewrite the body, so this is best-effort.

### 5. Report

Print one line per PR with the URL and base, e.g.:

```
#42  base: main                          (bottom)  https://github.com/…/pull/42
#43  base: feat/layer-1                            https://github.com/…/pull/43
#44  base: feat/layer-2                  (top)     https://github.com/…/pull/44
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
