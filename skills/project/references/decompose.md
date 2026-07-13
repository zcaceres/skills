# `/project decompose` — Split a Card into Subtasks

You are helping the user split a large, hard-to-grasp card on the GitHub Projects kanban into a handful of smaller subtask cards. The output is a **collaborative proposal**: you draft a decomposition, the user reshapes it (drop, merge, edit, regenerate), and only after explicit approval do you create the new cards and wire them to the parent.

Treat this like architecting a small PR stack. The point isn't just N tickets — it's slices that *fit together*, each independently shippable. False slicing (too coarse, too fine, overlapping scope) is expensive to undo once cards exist.

## When to use

- "decompose this card" / "break this into subtasks" / "split this task"
- "make these into sub-issues" / "let's slice up #42"
- "/project decompose [id|number|title]"
- The user is staring at a big card and wants help carving it down before starting work

## When NOT to use

- The card is already small/atomic (one focused change). Push back — say so and suggest just picking it.
- The user wants to *create* unrelated new tasks. Route to `/project new-task`.
- The user wants to *audit* the whole board for staleness. Route to `/project review`.

## Prerequisites

**Run the [backend guard](_guard.md) first.** It locates `.project/config.json`
(routing a legacy `.github/gh-project.json`, or an unconfigured repo, to
`/project setup`), confirms the **github** backend, and exports `$HELPER`,
`$PROJECT_NUMBER`, `$PROJECT_OWNER`, `$REPO_OWNER`, and `$REPO`. Stop if the guard
did. Then read the project title this subcommand also uses:

```bash
CFG=.project/config.json
TITLE_FIELD=$(jq -r '.title' "$CFG")   # project title, for `gh issue create --project`
```

The github sub-issue wiring and the `board.sh`/`gh` calls behind the adapter
verbs are documented in [backends/github.md](backends/github.md).

**Linear backend:** children are native sub-issues — pass `parentId` to
`create_issue` at create time and skip the sub-issues REST call and the parent
body checklist entirely. See
[backends/linear.md](backends/linear.md#per-subcommand-divergences).

## Step 1 — Resolve the parent card

Same identifier rules as `/project update`. Three input shapes, in priority order:

### A. Explicit project item id (`PVTI_…`), issue number, or title substring

```bash
$HELPER find "$SELECTOR"   # auto-detects which kind it is
```

If multiple rows match, **list them and ask** — don't pick the first. If zero match, surface the candidates considered and stop.

### B. Infer from conversation

If invoked bare ("decompose this", "break that one down"), guess:

1. `$HELPER list --query "-status:Done" > /tmp/board.jsonl`
2. Score each card by keyword overlap with the recent conversation (files, function names, feature nouns).
3. If one card is clearly ahead, propose it with one-line evidence and confirm.
4. If two or more tie, list the top 3 and ask which.

**Never decompose a card you guessed without explicit confirmation.** Creating wrong child cards is harder to undo than asking one extra question.

## Step 2 — Read the parent card in full

Don't propose subtasks from a 120-char preview. Pull the whole body:

```bash
$HELPER get "$ITEM_ID"
```

For issue-backed cards, also fetch labels and milestone — they constrain how the children should be slotted:

```bash
gh issue view "$ISSUE_NUMBER" --repo "$REPO_OWNER/$REPO" \
  --json title,body,state,milestone,labels,assignees,comments
```

Skim the comments. A card with 20 comments often already contains the slicing the user is reaching for — surface that rather than inventing a new one.

## Step 3 — Draft the decomposition

Propose **3–7 subtasks**. Fewer than 3 isn't really a decomposition; more than 7 means you're padding or the parent is genuinely two cards.

For each proposed subtask, draft:

- **Title** — imperative, concrete, ≤ 60 chars. Not "Refactor stuff" — "Extract retry policy into its own module".
- **Body** — 1–3 sentences: *what* changes, *why this is its own slice*, and *what done looks like*. If a specific file/function is the load-bearing target, name it.
- **Rationale tag** — one of `[setup]`, `[core]`, `[edge]`, `[wiring]`, `[docs]`, `[follow-up]`. Helps the user see the *shape* of the breakdown at a glance.
- **Dependency note** — `depends on #N` if a sibling must land first; `parallel-safe` if it can ship anytime.

Bias toward slices that are:

- **Independently shippable** — each can be a PR on its own without breaking main.
- **Reviewer-friendly** — under ~300 lines of diff each if possible.
- **Sequenced naturally** — setup before core before edges. A reader scanning the list should see how the work flows.

Bias against:

- Slices that just restate the parent at smaller scale ("Part 1 of foo", "Part 2 of foo").
- Pure-mechanical splits (one card per file) when the work is conceptually one unit.
- Slices smaller than a meaningful commit ("Add a `const`", "Rename a variable").

## Step 4 — Present the proposal (batched)

Show the whole proposal at once. Decomposition is a *shape* the user reviews holistically — not N independent verdicts.

```markdown
### Decomposing "<parent title>" (<PVTI_…>, <Issue #N | Draft>)

**Parent body (excerpt):**
> <first ~3 lines of body>

**Proposed subtasks (N):**

**1.** `[setup]` **Extract retry policy into its own module** · parallel-safe
   > Move the inline retry/backoff logic from `client.ts:120-180` into a new `retry.ts`. No behavior change. Sets up the next two slices.

**2.** `[core]` **Add exponential backoff with jitter** · depends on #1
   > Replace the fixed 1s sleep in the new `retry.ts` with `2^attempt * 100ms` plus ±25% jitter. Covered by `retry.test.ts`.

**3.** `[edge]` **Surface retry exhaustion as a typed error** · depends on #2
   > Today the loop just returns `null` after 5 tries. Throw `RetryExhaustedError` with the last underlying error attached.

**4.** `[docs]` **Document the retry contract in README** · parallel-safe
   > One paragraph in `README.md` under "Networking" — what gets retried, what doesn't, how to opt out.

**Subtask mode:** issue (matches parent)
**Will be created in:** Todo column

Reply with:
  - **accept** — create all N subtasks as-is
  - **drop 2**, **merge 1+2**, **edit 3: <new title>**, or **add: <new title>**
  - **regenerate** — toss this and try again
  - **regenerate with: <hint>** — try again with guidance (e.g. "smaller slices", "focus on the API surface", "merge the docs work")
  - **cancel** — stop without creating anything
```

If parent is a draft, set `Subtask mode: draft (matches parent — use \`mode: issue\` to override)` and note that drafts can't use the sub-issues hierarchy (only the body checklist will link them).

## Step 5 — Iterate

Apply the user's edits to the in-memory proposal and re-present. **Always re-show the full list after any edit** — partial diffs are easy to misread when the goal is judging the shape.

Accept these commands:

| Command | Effect |
|---------|--------|
| `accept` | proceed to creation |
| `drop N` / `drop N,M` | remove subtasks by number |
| `merge N+M` | combine into one; ask the user for the merged title/body if not obvious |
| `edit N: <new title>` | replace subtask N's title; ask for new body if user wants |
| `edit N body: <new body>` | replace subtask N's body |
| `add: <new title>` | append a new subtask; ask for body |
| `reorder N M ...` | re-sequence |
| `regenerate` | discard, re-draft from scratch |
| `regenerate with: <hint>` | re-draft using the hint |
| `cancel` | stop, no changes |

Renumber on each round so the user always types small numbers. Cap re-drafts at ~4 rounds — if you're still not converging, say "We've iterated 4 times — want to step back and reconsider the parent card itself?"

## Step 6 — Confirm subtask mode and create

Once the user accepts, confirm the mode choice (last chance to flip):

```markdown
About to create N subtask <issues|drafts> in Todo, linked to parent <PVTI_…>.
Mode: issue | draft   (override with `mode: draft` or `mode: issue`)
Proceed? (yes/no)
```

Then create each one. **Create them in dependency order** — a child that `depends on #N` should be created after #N exists so its body can reference the right issue number.

### Mode A — Issue subtasks (default when parent is an issue)

For each subtask:

```bash
CHILD_URL=$(gh issue create \
  --repo "$REPO_OWNER/$REPO" \
  --title "$CHILD_TITLE" \
  --body "$CHILD_BODY" \
  --project "$TITLE_FIELD")
CHILD_NUMBER=$(basename "$CHILD_URL")
```

Inherit `milestone` and `labels` from the parent unless the user said otherwise — keeps the slice grouped with the parent in repo views. Don't inherit `assignees` (decomposition doesn't imply ownership).

```bash
PARENT_MILESTONE=$(gh issue view "$PARENT_ISSUE" --repo "$REPO_OWNER/$REPO" --json milestone --jq '.milestone.title // empty')
PARENT_LABELS=$(gh issue view "$PARENT_ISSUE" --repo "$REPO_OWNER/$REPO" --json labels --jq '[.labels[].name] | join(",")')
```

Pass them on the `gh issue create` call:

```bash
gh issue create \
  --repo "$REPO_OWNER/$REPO" \
  --title "$CHILD_TITLE" \
  --body  "$CHILD_BODY" \
  --project "$TITLE_FIELD" \
  ${PARENT_MILESTONE:+--milestone="$PARENT_MILESTONE"} \
  ${PARENT_LABELS:+--label="$PARENT_LABELS"}
```

### Mode B — Draft subtasks (default when parent is a draft)

```bash
CHILD_ROW=$(gh project item-create "$PROJECT_NUMBER" \
  --owner "$PROJECT_OWNER" \
  --title "$CHILD_TITLE" \
  --body "$CHILD_BODY" \
  --format json)
CHILD_ITEM_ID=$(echo "$CHILD_ROW" | jq -r '.id')
```

Drafts can't be sub-issues (the API requires real issues), so the linkage is only via the parent body checklist.

## Step 7 — Wire children to the parent

Two mechanisms, applied together when possible:

### 7a — GitHub's sub-issues API (issue parent + issue children only)

If the parent is a real issue AND the child is a real issue, link via the sub-issues REST endpoint so the hierarchy renders natively on github.com.

The endpoint takes the child's **database id** (a plain integer), not the issue number or node id. Get it once per child:

```bash
CHILD_DB_ID=$(gh api "repos/$REPO_OWNER/$REPO/issues/$CHILD_NUMBER" --jq '.id')

gh api --method POST \
  "repos/$REPO_OWNER/$REPO/issues/$PARENT_ISSUE_NUMBER/sub_issues" \
  -F sub_issue_id="$CHILD_DB_ID"
```

If the call returns a 404, the sub-issues feature isn't enabled for this repo/owner yet (it rolled out gradually). Log a one-line note ("sub-issues API not available; using body checklist only") and continue — don't fail the whole run.

### 7b — Body checklist on the parent (always)

Append a `### Subtasks` section to the parent's body. This is the durable, low-tech link that works for every card type and is visible in every UI.

Format:

```markdown
### Subtasks

- [ ] #123 Extract retry policy into its own module
- [ ] #124 Add exponential backoff with jitter
- [ ] #125 Surface retry exhaustion as a typed error
- [ ] #126 Document the retry contract in README
```

For drafts as children, use the project URL instead of `#N`:

```markdown
- [ ] [Extract retry policy …](https://github.com/users/zcaceres/projects/4?pane=item&itemId=PVTI_…)
```

**Append, don't replace.** If the parent already has a `### Subtasks` section (the user has decomposed before), add the new rows underneath the existing ones, ideally under a sub-heading like `#### Round 2 (2026-06-08)`.

For an issue parent:

```bash
gh issue edit "$PARENT_ISSUE_NUMBER" --repo "$REPO_OWNER/$REPO" --body-file /tmp/parent-body.md
```

For a draft parent:

```bash
gh project item-edit --id "$PARENT_ITEM_ID" --body "$NEW_BODY"
```

## Step 8 — Ask about parent status

Decomposition often means work is now starting. Ask:

```markdown
Subtasks created. Update parent status?
  - **leave** — keep at <current status>
  - **in-progress** — move parent to In Progress (it's now a tracking card)
  - **done** — close out the parent entirely (rare; only if the parent is purely a placeholder)
```

If `in-progress` and the parent is already `In Progress`, skip silently. If `done`, double-check with the user — closing the parent before children are done is unusual and worth surfacing once.

Apply via the helper:

```bash
$HELPER set-status "$PARENT_ITEM_ID" "In Progress"
```

If the parent is an issue and the user picked `done`, also ask whether to close the underlying issue (same prompt pattern as `/project review`).

## Step 9 — Output

```
Decomposed "<parent title>" (<PVTI_…>) into N subtasks:

  #123  [setup]    Extract retry policy into its own module       → https://github.com/.../issues/123
  #124  [core]     Add exponential backoff with jitter            → https://github.com/.../issues/124
  #125  [edge]     Surface retry exhaustion as a typed error      → https://github.com/.../issues/125
  #126  [docs]     Document the retry contract in README          → https://github.com/.../issues/126

Wired to parent:
  Sub-issues API: 4 of 4 linked  (or "skipped — API unavailable")
  Body checklist: appended

Parent status: In Progress  (or "unchanged: Todo")

Next: `/project next` to start on the first subtask.
```

## Edge cases

- **Parent is already in Done.** Ask before proceeding — decomposing a done card usually means the user wants follow-up work as new cards, in which case `/project new-task` per item may be cleaner. If they confirm, proceed but don't move the parent back.
- **Parent body is empty.** You have nothing to slice from. Ask the user to add a few sentences first, OR have them describe the work in chat and incorporate it into the parent body before drafting subtasks.
- **User wants only one subtask.** That's not a decomposition — that's editing the parent's title/body. Route to `/project update`.
- **User wants ten+ subtasks.** Push back once: "That's a lot — usually 3-7 is enough. Are some of these actually checklist items inside one card?" If they insist, proceed.
- **Sub-issues API returns 422 "already a sub-issue".** A child was wired previously (rare on freshly-created issues). Log and skip — checklist still gets appended.
- **Child creation fails partway through.** Report which children were created, which weren't, and stop. Don't append a checklist that points at issues you didn't make. The user can re-invoke with the remaining slice list.
- **Parent has labels the user doesn't want on children.** Surface the inherited labels in step 6's confirmation: "Children will inherit labels: bug, p1. Override?" Accept `labels: <new list>` or `labels: none`.
- **Repo has a `Sub-issue` label or similar convention.** Don't auto-apply — that's a project-specific norm, not something this subcommand knows about. If the user mentions it, accept and add.

## Guidelines

- **Don't slice for slicing's sake.** A small card stays a small card. Saying "no, this is atomic" is a valid output.
- **Quote the parent body.** When proposing subtasks, the user should be able to map each subtask back to a phrase or section in the parent. If you can't, you're inventing scope.
- **Convert relative dates.** "Next sprint" becomes a real date when written into a card body.
- **Don't widen scope.** If the parent says "add CSV export" and you find yourself proposing "also rework the export pipeline", that's a sibling card, not a child — surface as a Bonus suggestion at the end, don't include it in the decomposition.
- **Sequenced, not chronological.** The order matters because of dependencies, not because of when the user will do them. Don't write `Part 1`, `Part 2` in titles — write the verbs.
- **One parent per invocation.** Decomposing two parents in one run muddles the conversation. If the user wants both, do them sequentially.
- **Strip noise.** A parent card with 100 lines of debug logs in the body is a candidate for `/project update` first, then decompose against the cleaned body.
