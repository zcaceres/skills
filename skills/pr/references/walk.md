# `/pr walk` — Walk an Open PR Stack

Prepare an annotatable review packet for every open PR in the stack, walk
the user through it bottom-to-top, then apply all confirmed actions across
the stack after the walk is complete. This workflow is backend-neutral:
GitHub defines the published stack, and the generated artifacts are only
Markdown documents and exact patches.

**Arguments:**

- `/pr walk` — start from the current branch's PR.
- `/pr walk <number-or-URL>` — start from that PR.
- `/pr walk --resume <session-dir>` — resume an existing packet without
  fetching or overwriting it.

## Phase 1: Prepare

### 1. Pre-flight

Require `git`, an authenticated `gh`, a GitHub remote, and a repository
root. Conversational mode also uses
[`git-delta`](https://github.com/dandavison/delta) for colorized terminal
diffs. The helper verifies the executable instead of trusting the name
`delta`, because another CLI may shadow it. If needed, point directly to
git-delta:

```bash
export PR_WALK_DELTA=/path/to/delta
```

Generated review packets must not enter source control. Check:

```bash
git check-ignore -q artifacts/pr-walk/.pr-walk-ignore-check
```

If it fails, stop and ask the user to choose one:

- add `artifacts/` to the repository's `.gitignore`; or
- add `/artifacts/pr-walk/` to `.git/info/exclude` for a private,
  checkout-local exclusion.

Never change either file without confirmation.

### 2. Generate the packet

Locate this skill's directory, provision its binary if needed, and run:

```bash
SKILL_BINARY_CAPABILITY=walk-render "$SKILL_DIR/scripts/fetch-binary.sh"
"$SKILL_DIR/scripts/run.sh" walk-prepare [number-or-URL]
```

The capability requirement prevents an old, gitignored nudge binary from
surviving a skill upgrade and silently no-oping on the walk commands.

The preparer:

1. Resolves the selected/current PR.
2. Finds its open linear stack by following GitHub head/base
   relationships in both directions.
3. Stops on a forked stack (multiple open child PRs) instead of guessing.
4. Writes `artifacts/pr-walk/<timestamp>-<stack>/00-stack.md`.
5. Writes one clearly numbered `.md` and canonical `.patch` per PR.
6. Includes the PR body, submitted reviews, conversation comments, and
   inline review comments, plus the captured head SHA, base SHA, and PR
   update timestamp.
7. Re-checks every PR's state, head SHA, head branch, and base branch
   before atomically publishing the packet. A merge, push, or retarget
   during generation aborts and leaves no partial session.

`gh pr diff --color never` is the source of each canonical patch. The
Markdown splits that patch into file sections for readability, but does
not replace it. Do not substitute a generated summary for the actual
diff. If GitHub refuses a large diff, surface the error and stop.

Do not create clones, worktrees, manifests, JSON files, or source
checkouts in the artifact session.

### 3. Start the walk

Open/read `00-stack.md`. If the user is editing the Markdown directly,
tell them:

- put all feedback for the PR in the single `Notes` section at the
  bottom, mentioning a file or line when location matters;
- leave generated diff blocks unchanged;
- edit in their editor and tell you when the step is ready.

Otherwise, use **conversational mode**:

1. Render the complete current PR as one review unit by running:

   ```bash
   "$SKILL_DIR/scripts/run.sh" walk-render <numbered-review-document.md>
   ```

   This preserves the metadata, PR body, submitted reviews, conversation
   comments, and inline comments as text while replacing each generated
   diff fence with an independent `git-delta --paging=never
   --line-numbers` rendering. Rendering each fence independently is
   required: piping the complete Markdown document through git-delta can
   misclassify later notes as diff lines. The `.patch` artifact remains
   canonical and unchanged.

   If the renderer cannot find git-delta, show its actionable error and
   ask the user whether to install/configure it or continue with the raw
   Markdown diff. Do not silently invoke an unrelated `delta` executable.
   Do not pause or prompt between files.
2. After the entire PR, show this stable control bar:

   ```text
   [a <text>] add note  [e [target]] explain  [n] next PR
   [b] previous PR     [r] render again      [q] save and pause
   ```

3. Interpret the controls exactly:
   - `a <text>` — append the text to this PR document's single `Notes`
     section. Preserve file/line references. Confirm the recorded note.
   - `e` — explain the complete PR without recording a note.
   - `e <target>` — explain the named file, hunk, line, reviewer comment,
     or question without recording a note.
   - `n` — recap this PR's collected notes and advance to the next PR.
     On the final PR, finish the walk and present the consolidated plan.
   - `b` — return to the previous PR without losing notes.
   - `r` — render the complete current PR again, including all files.
   - `q` — save progress in the packet and pause without applying.
4. Accept natural-language input too, but never silently classify a
   question as an action. State what, if anything, you recorded.

If the complete PR cannot safely fit in one response, preserve the PR as
the review unit and split only for transport:

- label output `PR N/M · Part X/Y`;
- continue with `m` ("more") until all parts have been shown;
- do not prompt between files or treat a part as a separately reviewed
  item;
- show the normal control bar only after the final part;
- never replace omitted diff content with a summary.

Do not infer approval merely because a note exists.

## Phase 2: Walk and Collect

For each numbered document, bottom-to-top:

1. In direct-edit mode, read the document after the user says it is
   ready. In conversational mode, run `walk-render` for the complete PR
   and process controls until the user enters `n`.
2. Extract additions from the single `Notes` section. Ignore the
   generated PR text, reviewer comments, and placeholder unchecked bullet.
3. Classify each addition as:
   - code change;
   - test or verification request;
   - GitHub metadata change (title/body/base);
   - reviewer reply;
   - stack operation (sync/rebase/reorder);
   - question/observation with no action.
4. Summarize what you recorded, answer discussion-only items, and move to
   the next document. Do not edit code, rewrite branches, push, or mutate
   GitHub yet.
5. Mark the PR's checkbox in `00-stack.md` after its notes are understood.

Questions and observations remain discussion items. Never turn them into
code changes without the user's answer.

After the final document, present one consolidated stack-wide plan,
ordered bottom-to-top. Include the target PR and branch for every
mutation, all tests, all reviewer replies, all metadata changes, and the
required rebases. Ask once for approval to apply the whole plan. If the
user changes the plan, revise it and ask again.

## Phase 3: Apply the Approved Stack Plan

### 1. Refresh and detect drift

Before changing code:

```bash
git status --porcelain
git fetch origin <base-and-every-head-branch>
```

Require a clean working tree. Do not auto-stash. Re-fetch every PR's
state, `headRefOid`, head branch, and base branch. Compare them with the
values in its document.

If any PR is no longer open, its head/base position or SHA moved, or its
update timestamp changed, stop. Report the changed PRs and generate a new
packet (never overwrite the annotated packet) before applying stale
line-level instructions.

### 2. Record the original stack

Record every fetched head SHA bottom-to-top before rewriting anything.
Also record the current branch so it can be restored.

For each local stack branch:

- create it from `origin/<head>` if absent;
- if it exists and is not exactly at the fetched head, stop and ask how
  to reconcile it;
- never reset or discard an existing local branch.

Fork-owned PR heads may not be pushable through `origin`. Detect this
before editing and stop with the exact ownership/permission limitation.

### 3. Apply bottom-to-top

For each PR in the approved plan:

1. Switch to its head branch.
2. If its parent was rewritten, rebase the branch with the recorded old
   parent and new parent:

   ```bash
   git rebase --onto <new-parent-tip> <recorded-old-parent-tip> <branch>
   ```

3. Apply only that document's approved changes.
4. Run the approved and repository-relevant tests.
5. Stage explicit files only and commit the fix on that PR's branch.
6. Record the new tip.

Even when a PR has no code notes, rebase it onto a rewritten parent so
the stack remains contiguous. Stop on conflicts; report the branch and
files, and ask the user whether to resolve or abort. Never guess at a
conflict resolution.

If the approved plan requests a trunk sync, perform it before applying
code notes. Because that invalidates every generated diff, stop after
the sync and generate a fresh packet before continuing.

### 4. Preview and push

Show the complete old-tip → new-tip table and summarize:

- commits added per PR;
- tests run;
- planned reviewer replies and PR metadata edits;
- every branch that will be force-updated.

The user's stack-wide approval covers these planned mutations, but ask
again if the implementation, tests, conflict handling, or resulting
branch set materially differs from the approved plan.

Push bottom-to-top with an explicit lease tied to the fetched SHA:

```bash
git push \
  --force-with-lease=refs/heads/<branch>:<recorded-remote-sha> \
  origin <branch>:refs/heads/<branch>
```

Stop on the first rejected lease. Never use plain `--force`, and never
continue pushing descendants after a parent push fails.

### 5. Sync GitHub discussion and metadata

After all branch pushes succeed:

- Apply approved title/body/base edits with `gh pr edit`.
- Reply to inline comments using their visible comment IDs:

  ```bash
  gh api "repos/{owner}/{repo}/pulls/<pr>/comments/<comment-id>/replies" \
    -f body="..."
  ```

- Use `gh pr comment` for approved PR-level replies.
- Do not resolve review threads unless the user explicitly asks.

Append an `## Applied` section to each acted-on review document with the
new SHA, tests, pushes, metadata edits, and reply URLs. Preserve the
original notes and patch. Restore the branch the user started on.

## Resume

For `--resume <session-dir>`:

1. Verify the path is under the current repository's
   `artifacts/pr-walk/`.
2. Read `00-stack.md` and the numbered Markdown files.
3. Continue at the first unchecked stack item, or ask which item if all
   are checked.
4. Do not regenerate, refresh, or overwrite the session automatically.

## Important

- Open PRs only. A closed/merged selected PR is rejected.
- A `.patch` file is canonical; the Markdown is the review surface.
- Never edit code or GitHub from generated reviewer comments alone.
- Never apply anything before the completed walk's stack-wide approval.
- Never use plain force-push or delete remote stack branches.
- Report the artifact directory and all affected PR URLs when done.
