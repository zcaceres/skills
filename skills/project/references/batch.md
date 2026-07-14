# `/project batch` — Create, Update, or Delete Many Cards at Once

You are applying the same kind of operation to **several** cards on the
project-tracker kanban board in one invocation: creating a batch of new cards,
updating a set of existing cards, or removing a set of cards.

**This subcommand is an envelope, not a reimplementation.** The per-card recipes
already live in the single-card references — `batch` reuses them:

| Mode | Per-item recipe comes from |
|------|----------------------------|
| `create` | [new-task.md](new-task.md) |
| `update` | [update.md](update.md) |
| `delete` | [delete.md](delete.md) |

Batch's own job is the four things a loop needs that a single command doesn't:
**ingest a list**, **preview the whole set once**, **confirm once** (not N
times — that defeats the point), and **apply in a loop that continues past a
failed item and reports a per-item tally.** When you need the exact commands for
a given card type (issue vs draft, milestone/label inheritance, sub-issue wiring,
the linear divergences), open the matching single-card reference rather than
guessing here.

## When to use

- "create these five tickets" / "add all of these to the board"
- "move every Done-looking card to Done" / "update all the `stale` cards"
- "delete these three drafts" / "clear out cards 12, 14, and 19"
- "/project batch create|update|delete [args]"
- The user hands you a list (inline, a file, or a board query) and wants the
  same action applied across it.

## When NOT to use

- **One card.** Route to `new-task` / `update` / `delete`. The per-card
  confirmation those give is better when there's only one.
- **Splitting one card into children.** That's `decompose` — it wires
  parent/child links batch does not.
- **Auditing the board for staleness.** That's `review` — it gathers codebase
  evidence per card before proposing moves. Batch applies *user-supplied*
  changes; it does not investigate.
- **Heterogeneous operations** (create one, delete another, update a third in a
  single run). Batch applies *one* mode across the set. Run it once per mode.

## Mode dispatch

Parse the first whitespace-separated token of this subcommand's arguments:

- `create` → [Mode: create](#mode-create)
- `update` → [Mode: update](#mode-update)
- `delete` → [Mode: delete](#mode-delete)
- anything else / empty → print the three modes above and ask which. Do **not**
  guess the mode — the blast radius differs wildly (create is additive, delete
  is destructive).

Everything after the mode token is that mode's arguments (a file path, a
`--query`, an inline list, or nothing — see each mode).

## Prerequisites (all modes)

**Run the [backend guard](_guard.md) first.** It locates `.project/config.json`
(routing a legacy `.github/gh-project.json`, or an unconfigured repo, to
`/project setup`), determines the backend, and — on **github** — exports
`$HELPER` (`.project/scripts/board.sh`), `$PROJECT_NUMBER`, `$PROJECT_OWNER`,
`$REPO_OWNER`, and `$REPO`. Stop if the guard did. Every mode delegates its
per-card work to a single-card reference that opens with the same guard, so the
guard runs once here and the recipes below assume its exports.

On the **github** backend, selectors resolve through `$HELPER find-many` (one
board fetch for the whole set) and bulk changes apply via the same
`board.sh` / `gh` calls the single-card references use. `find-many` must exist
for `update`/`delete`. If the installed helper predates it (`find-many` errors
with `unknown subcommand`), tell the user to re-run `/project setup` to refresh
the script, then fall back to looping `find` per selector in the meantime.

**Linear backend:** there is no `board.sh`. Selectors resolve and bulk changes
apply through the Linear MCP adapter verbs — the same ones new-task / update /
delete already use per [backends/linear.md](backends/linear.md). Wherever a mode
below reaches for `$HELPER find-many`, resolve each selector on linear with
`find_item` instead (`list_issues` under the Completeness rule, matched
locally), and apply with `create_issue` / `update_issue`. "Delete" means
cancel/archive (move the issue to the Cancelled state), not unlink. The per-mode
callouts point at the specific divergences — don't re-document the MCP here.

## Common workflow (every mode follows this shape)

### A. Ingest the list

Accept the items in whatever form the user supplied. Normalize to an in-memory
list before doing anything else.

1. **Inline in the prompt** — the user typed or pasted the items. Parse them.
2. **A file path** — `batch <mode> path/to/items.json` (or `.md` / `.csv`).
   - **JSON** (most precise): an array of item objects, schema per mode below.
   - **Markdown**: a checklist (`- [ ] Title — body`) or a table. One row per card.
   - **CSV**: header row naming the columns, then one card per line.
3. **A board query** (`update`/`delete` only) — `batch <mode> --query "<q>"`
   selects the targets straight from the board (e.g. `--query "status:Done"`,
   `--query "label:stale -status:Done"`). On **github**, resolve with the helper:
   ```bash
   $HELPER list --query "$QUERY" > /tmp/batch-targets.jsonl
   ```
   On **linear**, resolve with `list_items` (the `list_issues` adapter verb)
   under the Completeness rule, filtering by the query's state/label/assignee.

If the input is ambiguous (you can't tell where one item ends and the next
begins), **stop and ask for a cleaner list or a file** rather than guessing the
boundaries. A wrong split here multiplies across every item.

### B. Normalize to a table

Build one in-memory row per card with the fields that mode needs (schemas
below). Number the rows 1..N so the user can reference them in the refine step.

### C. Preview the whole set — once

Print the entire batch as a numbered table so the user reviews it *holistically*
(like `decompose`, the value is judging the set as a shape, not N verdicts). Show
enough to catch mistakes: for `create`, the titles + body previews + shared
defaults; for `update`, current vs proposed per card; for `delete`, what's about
to be lost per card. Mode sections below give the exact layout.

Always surface, before asking to proceed:
- **Count** — "About to create/update/delete N cards."
- **Unresolved selectors** (`update`/`delete`) — `matchCount: 0` rows. List them
  and say they'll be **skipped**.
- **Ambiguous selectors** (`update`/`delete`) — `matchCount > 1` rows. List the
  candidates and **make the user disambiguate or drop them** — never auto-pick
  the first match across a batch.

### D. Refine loop (reuse the `decompose` vocabulary)

Let the user reshape the set before anything is applied:

| Command | Effect |
|---------|--------|
| `accept` | proceed to confirmation |
| `drop N` / `drop N,M` | remove rows by number |
| `edit N: <change>` | revise row N (re-prompt for specifics if unclear) |
| `add: <item>` | append a row (`create` only) |
| `cancel` | stop, change nothing |

Re-show the full table after any edit and renumber. Apply nothing during the
refine loop.

### E. Confirm — once for the whole batch

After `accept`, ask for a single confirmation covering the whole set. This is
the one gate; do not prompt per item. The strength of the gate scales with blast
radius:

- **create** — "Create these N cards? (yes/no)".
- **update** — "Apply these N updates? (yes/no)". Call out any status changes
  explicitly (status moves are decisions, not side effects).
- **delete** — **require the user to type `yes`** after seeing the full set and
  the per-type consequences (draft = destroyed, issue = unlinked; on linear =
  cancelled/archived). Anything other than an affirmative cancels the entire
  batch. See [Mode: delete](#mode-delete).

### F. Apply in a loop — continue on error

Iterate the accepted rows and apply each using the per-item recipe from the
matching single-card reference. **Do not abort the whole batch on one failure** —
capture the outcome (`ok` / `failed: <reason>` / `skipped: <reason>`) per row and
keep going. The exception is a systemic failure (auth lost, board unreachable):
stop and report, since every remaining item would fail the same way.

Echo a terse progress line per item so a long batch is observable:

```
[3/12] created #128 "Add retry jitter"
[4/12] FAILED "Document the API" — unknown milestone "v9"
```

### G. Report a tally + the remainder

End with a tally and, on any partial failure, the list of items that did **not**
land so the user can re-run just those:

```
Batch <create|update|delete>: N requested
  Applied:  X
  Skipped:  Y   (unresolved/ambiguous selectors, or user-dropped)
  Failed:   Z

Failed items (re-run after fixing):
  - "Document the API" — unknown milestone "v9"
  - #88 — issue already closed
```

Never claim a clean success when only part of the batch landed.

---

## Mode: create

Create several new cards. Per-item recipe and all card-type detail (issue vs
draft, milestone/labels/assignees, initial status, the project-linking
fallback, the linear no-drafts divergence): **[new-task.md](new-task.md)** — read
it for the exact adapter verbs / flags. This mode only adds the batch envelope
and **shared defaults**.

**Linear backend:** no draft type — every item is a first-class issue; ignore
`mode`/`defaultMode` (say so once). Per-item optional fields are
priority/estimate/cycle/project, not milestone/labels/assignees. Create each row
with `create_issue`. See
[backends/linear.md](backends/linear.md#per-subcommand-divergences) via
new-task.md.

### Item schema

```jsonc
{
  "title": "Add retry jitter",         // required
  "body": "Replace fixed sleep …",      // optional (prefer ≥ 1 sentence)
  "mode": "issue",                       // optional; github only, default = config defaultMode
  "labels": "bug,p1",                    // optional; github issues only
  "milestone": "v0.4",                   // optional; github issues only
  "assignees": "@me",                    // optional; github issues only
  "status": "Todo"                       // optional; default Todo
}
```

### Shared defaults

Most batches share mode/labels/milestone/status — collect those **once** and
apply to every item, letting any per-item field override. Don't ask the same
question N times. Example confirmation header:

```
Shared defaults: mode=issue · milestone=v0.4 · labels=feature · status=Todo
(any item may override its own fields)
```

### Preview layout

```markdown
### Creating N cards   (mode=issue · milestone=v0.4 · labels=feature)

 1. Add retry jitter
    > Replace the fixed 1s sleep with 2^attempt*100ms ±25% jitter.
 2. Surface retry exhaustion as a typed error
    > Throw RetryExhaustedError after 5 tries instead of returning null.
 …

Reply: accept · drop N · edit N: … · add: … · cancel
```

### Apply

For each accepted item, run the create recipe from `new-task.md` (github: Mode A
issue by default, Mode B draft on request; linear: `create_issue`), folding in
the shared defaults. Capture the new issue URL / item id per item. If an item
wants a non-`Todo` initial status, move it after creation with the
`set_item_status` verb — on github:

```bash
ITEM_ID=$($HELPER find "$ISSUE_NUMBER" | jq -r '.id')
$HELPER set-status "$ITEM_ID" "In Progress"
```

**Stop after creating the cards.** As with single `new-task`, creating cards is
a planning action — do **not** start implementing any of the work described.
End your turn after the tally.

## Mode: update

Apply updates across a set of existing cards. Per-item recipe and card-type
detail (draft title/body via `--id`; issue title/body via `gh issue edit`;
one-field-per-`item-edit`; append-vs-replace body discipline; the linear
`update_issue` mapping): **[update.md](update.md)**. This mode adds selector
resolution and the batch envelope.

**Linear backend:** title/body/status all go through `update_issue`; "custom
fields" map to Linear natives (priority/estimate/cycle/project), not GitHub
single-selects. Resolve each selector with `find_item` rather than `find-many`.
See [backends/linear.md](backends/linear.md#per-subcommand-divergences) via
update.md.

### Item schema

```jsonc
{
  "selector": "42",                 // PVTI_… | issue# | SKL-… | title substring | (from --query: the .id)
  "title": "New title",             // optional
  "bodyAppend": "### Update 2026-06-18\n…",  // optional — preferred over replace
  "bodyReplace": "…",               // optional — only if user explicitly wants a clobber
  "status": "In Progress"           // optional
}
```

### Resolve every selector in one fetch

On **github**, pass all selectors to `find-many` (one board fetch, not one per
selector):

```bash
$HELPER find-many "42" "PVTI_bbb" "csv export" > /tmp/batch-resolved.jsonl
```

Each output row is `{"selector":…, "matchCount":N, "matches":[…]}`. Triage:

- `matchCount == 1` → resolved; carry the match's `.id`.
- `matchCount == 0` → **skip** and report (no card matched that selector).
- `matchCount > 1` → **ambiguous**; list the candidates and make the user pick
  or drop. Never auto-pick across a batch.

If the targets came from `--query` instead of selectors, they're already
resolved board rows — skip `find-many` and carry each `.id` directly. On
**linear**, there is no `find-many`: resolve each selector with `find_item` and
apply the same `matchCount` triage (0 = skip, >1 = disambiguate).

### Preview layout

```markdown
### Updating N cards

 1. #42 "Add CSV export"   [Issue · Todo]
      Title  → (unchanged)
      Body   → append "### Update 2026-06-18 …"
      Status → In Progress
 2. #51 "Fix flaky retry test"   [Issue · In Progress]
      Status → Done
 …

Skipped (unresolved): "old export thing" — no match
Ambiguous: "retry" → #51, #77  (pick one or drop)

Reply: accept · drop N · edit N: … · cancel
```

Default to **appending** body context under a dated heading; replace only on
explicit request. Call out status changes — they're explicit decisions.

### Apply

For each accepted card, run the update recipe from `update.md`: on github,
title/body via `gh issue edit` (issues) or `gh project item-edit --id` (drafts)
and status via `$HELPER set-status "$ITEM_ID" "<status>"`; on linear, all three
via `update_issue`. Remember a github issue-backed `item-edit` is one field per
call — loop fields per card. Capture per-card outcome for the tally.

## Mode: delete

Remove a set of cards from the board. **This is the destructive mode — it keeps
the strongest gate.** Per-item recipe and the full draft-vs-issue (and
linear cancel/archive) consequence breakdown: **[delete.md](delete.md)**. Batch
does not weaken any of delete's safety rules; it just lets the user confirm the
*set* once instead of N times.

**Linear backend:** there is no unlink — "delete" means cancel/archive: move each
issue to the Cancelled state via `update_issue`; the issue stays in the
workspace. There is no `gh project item-delete` and no "close/delete the
underlying issue" secondary decision. State plainly that the cards will be
cancelled, not destroyed. See
[backends/linear.md](backends/linear.md#per-subcommand-divergences) via
delete.md.

### Honor the "move to Done, don't delete" norm first

Before previewing, check whether the user is really trying to *archive finished
work*. If the targets look Done (or the user described them as "completed"), push
back once — this repo's norm is **move finished items to `Done`, don't delete
them** (deleted drafts lose their history irrecoverably). Offer
`batch update --query … status:Done` as the alternative. Proceed with deletion
only if the user confirms they really want the cards gone.

### Resolve selectors

Same as update — `find-many` (github) or `find_item` (linear), or `--query`,
then triage `matchCount`:

```bash
$HELPER find-many "12" "14" "19" > /tmp/batch-del.jsonl
```

`matchCount == 0` → skip & report. `matchCount > 1` → **do not delete** —
ambiguity on a destructive op is a hard stop for that selector; make the user
disambiguate or drop it.

### Preview — show what's about to be lost

```markdown
### About to delete N cards

 1. PVTI_aaa  Draft        "Spike: websockets"      [Todo]
      > body excerpt …   ⚠ draft body is not stored anywhere else
 2. PVTI_bbb  Issue #88    "Old export prototype"   [Done]
      > unlinks issue #88 (stays open on the Issues tab)
 …

Skipped (unresolved): "foo" — no match
Ambiguous (will NOT delete): "export" → #88, #91

Type `yes` to delete all N. Anything else cancels the whole batch.
```

For github issue-backed cards, surface the unlink-vs-close-vs-delete distinction
from `delete.md`. Removing from the board (`gh project item-delete`) leaves the
underlying issue open; closing or deleting the issue is a **separate** decision —
ask about it once for the whole set, and treat "also delete the underlying
issues" as a second typed confirmation (it's irreversible and admin-gated). On
**linear**, "delete" is cancel/archive — there is no unlink and no secondary
close/delete step.

### Apply

For each confirmed card, run the delete recipe from `delete.md`. On github:

```bash
gh project item-delete "$PROJECT_NUMBER" --owner "$PROJECT_OWNER" --id "$ITEM_ID"
```

On linear: `update_issue(id, stateId = statusMap.cancelled)`. Continue past a
per-item failure; capture outcomes. Note: `gh project item-delete` (and `gh
issue close`/`delete`) are **deliberately not in the `/project setup` permission
allowlist**, so each call may prompt for approval. That friction is intentional
on a bulk-destructive path — don't try to route around it with a wrapper or
`--yes` shortcut.

## Edge cases

- **Empty list / nothing resolves.** If ingestion yields zero items (or every
  selector misses), say so and stop. Don't create a placeholder or pick "closest"
  cards.
- **Duplicate items in a create batch.** If two rows have identical titles, flag
  it in the preview — the user may have pasted a dupe. Don't silently create two.
- **Mixed card types in update/delete.** A batch may span issues and drafts
  (github). That's fine — apply the right per-type recipe per card. Surface the
  type in the preview so the user sees, e.g., which deletes are destructive
  (draft) vs unlinks (issue). On linear every item is an issue, so this is moot.
- **A selector matches a card already in the desired state** (e.g. update to
  `Done` a card already `Done`). Skip it as a no-op and note it; don't fail.
- **Huge batch (50+ items).** Confirm the count explicitly and offer to chunk
  ("apply in groups of 20, pausing between?"). A 200-item destructive batch
  deserves a second look.
- **Partial failure midway.** Already covered by continue-on-error — but make the
  remainder list copy-pasteable so the re-run is trivial.
- **`find-many` unavailable** (older installed github helper). Fall back to
  looping `find` per selector and tell the user to re-run `/project setup` to
  refresh the helper. Don't hand-roll the `item-list` + `jq` resolution inline —
  that's exactly the truncation/ID-mixing trap the helper exists to prevent.
- **Sensitive content in bodies.** Same as `update`: before writing
  conversation context into a public board, flag env vars / tokens / customer
  names and offer to strip them — across every item, not just the first.

## Guidelines

- **Reuse, don't reimplement.** The per-card recipes live in `new-task.md`,
  `update.md`, and `delete.md`, and their backend commands in
  [backends/github.md](backends/github.md) / [backends/linear.md](backends/linear.md).
  If you find yourself re-typing `gh issue create` flags here, stop and read the
  single-card reference instead — it has the edge cases (project-link fallback,
  milestone inheritance, one-field-per-item-edit, the linear divergences) this
  file deliberately doesn't duplicate.
- **One preview, one confirmation.** Per-item prompts defeat the purpose of a
  batch. But never skip the *single* whole-set confirmation — especially for
  delete.
- **Continue past failures; report the remainder.** A bad item shouldn't sink
  the batch, and the user shouldn't have to diff your output to find what's left.
- **Never auto-resolve ambiguity across a batch.** One wrong match in a single
  command is recoverable; the same mistake times N is not. `matchCount > 1` is a
  question, not a default.
- **Respect the Done norm on delete.** Push back once before bulk-deleting
  finished-looking cards; offer the status move instead.
- **Convert relative dates** ("today", "next sprint") to absolute when they go
  into card bodies — they rot otherwise.
