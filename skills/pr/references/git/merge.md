# `/pr merge` — Land the Stack

Merge stacked pull requests with GitHub's first-party asynchronous stack merge
API. It merges every open pull request from the bottom through a selected target
as one all-or-nothing request (unless GitHub adds the stack to a merge queue).

> The released `gh stack` extension may print that CLI stack merging is not yet
> supported. Do **not** fall back to `gh pr merge`: GitHub rejects that legacy
> endpoint for a stacked PR. Use the asynchronous API below through `gh api`.

## Flags

- `--merge` (default), `--rebase`, or `--squash` — choose merge method.
- `--all` — target the top branch's PR; without it, target the current branch's
  PR and merge every layer below it.
- `--dry-run` — show the stack and proposed merge method, then stop.

## Workflow

### 1. Pre-flight and choose the target

```bash
gh stack --help >/dev/null || {
  echo 'Install the official extension: gh extension install github/gh-stack' >&2
  exit 1
}
git status --porcelain
gh stack view --json
```

Stop if the working tree is dirty. Resolve the target PR from the stack JSON:

```bash
# Default: merge through the current branch's PR.
TARGET_PR=$(gh stack view --json | jq -r '.branches[] | select(.isCurrent).pr.number')

# With --all: merge through the top branch's PR.
TARGET_PR=$(gh stack view --json | jq -r '.branches[-1].pr.number')

[ -n "$TARGET_PR" ] && [ "$TARGET_PR" != null ] || {
  echo 'Current target has no submitted pull request' >&2
  exit 1
}
```

For `--dry-run`, report the displayed stack, `TARGET_PR`, and selected merge
method, then stop without making an API call.

### 2. Submit and poll the asynchronous merge

Resolve `METHOD` to `merge`, `rebase`, or `squash` from the requested flag. The
API response is either terminal (`merged`, `failed`, or `enqueued`) or `pending`
with a polling UUID nested in `details`:

```bash
REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
RESPONSE=$(gh api --method PUT "repos/$REPO/pulls/$TARGET_PR/merge-async" \
  -f merge_method="$METHOD")
STATUS=$(jq -r '.status' <<<"$RESPONSE")

if [ "$STATUS" = pending ]; then
  UUID=$(jq -r '.details.uuid // empty' <<<"$RESPONSE")
  [ -n "$UUID" ] || { echo 'Merge API returned pending without a UUID' >&2; exit 1; }
  while [ "$STATUS" = pending ]; do
    sleep 2
    RESPONSE=$(gh api "repos/$REPO/pulls/$TARGET_PR/merge-async/$UUID")
    STATUS=$(jq -r '.status' <<<"$RESPONSE")
  done
fi

printf '%s\n' "$RESPONSE"
[ "$STATUS" = merged ] || [ "$STATUS" = enqueued ] || exit 1
```

Do not use `--delete-branch`, manually retarget PR bases, or manually rebase
child branches after submitting this request; GitHub owns the stack operation.

### 3. Report

Report the terminal API status. `merged` means the whole selected portion of the
stack landed atomically. `enqueued` means GitHub added it to a merge queue, whose
processing can land layers in separate groups. For `failed`, surface the API
response and stop.

## Important

- `/pr merge` is irreversible. Run it only when the user explicitly asks.
- Never try to bypass GitHub merge requirements.
- Do not use `gh pr merge` for a stacked pull request; GitHub rejects it.
