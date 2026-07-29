# `/project walk` — Triage a Scope of Cards One by One

You are walking the user through a **scoped set** of board cards, one at a time,
in a tight decision loop. For each card you print a **concise** block — enough to
judge it, not the whole body — then offer a compact **decision menu** and apply
the pick immediately before advancing to the next card.

This is **interactive triage / grooming**, not work-picking and not auditing:

- Unlike [`next`](next.md), walk does not stop at one card to start work on it —
  it moves through the *whole scope* so the user can groom it.
- Like [`review`](review.md), walk reads the codebase to inform each card. It
  distills the evidence to a **one-line signal**, adds a **suggested change** when
  warranted, and lets the user accept that default or choose another action. Walk
  is the fast hands-on grooming pass; `review` is the deeper evidence-driven
  reconciliation.
- Unlike [`batch`](batch.md), walk decides and applies **per card as you go**
  (each action lands immediately), rather than previewing a whole set and
  confirming once. Reach for `batch` when the same change applies to many cards;
  reach for `walk` when each card needs its own decision.

Walk is an **envelope**: every action it applies reuses a single-card recipe
(`update` / `milestone` / `decompose` / `delete` / the `set_item_status` verb).
It adds the scope iterator, the concise card block, and the decision menu — it
does not reimplement those recipes or loosen their safety rules (delete still
requires a typed `yes`).

## When to use

- "walk me through the milestone" / "walk the v0.4 cards" / "triage this milestone"
- "go through the Todo column one by one" / "groom the backlog"
- "walk me through the `stale` cards so I can decide on each"
- "walk the Todo column" / "walk everything labeled `stale`" / "walk the open bugs"
- "/project walk" (bare → everything not-Done)

## When NOT to use

- **Pick one card to start working.** → [`next`](next.md) (ranks, hands off one).
- **Audit the board against the codebase.** → [`review`](review.md). Both read the
  repo, but `review` proposes a status verdict per card and asks you to approve it;
  `walk` distills the same evidence to a one-line signal and hands you the full
  decision menu. Reach for `review` to reconcile the board; `walk` to groom it.
- **Apply the *same* change to a known set.** → [`batch`](batch.md) (one preview,
  one confirmation). Walk is for *different* decisions per card.
- **Split one card into subtasks.** → [`decompose`](decompose.md) directly.

## Prerequisites

**Run the [backend guard](_guard.md) first.** It locates `.project/config.json`
(routing a legacy `.github/gh-project.json`, or an unconfigured repo, to
`/project setup`), determines the backend, and — on **github** — exports
`$HELPER` (`.project/scripts/board.sh`), `$REPO_OWNER`, `$REPO`,
`$PROJECT_OWNER`, and `$PROJECT_NUMBER`. Stop if the guard did. The `board.sh` /
`gh` calls behind the adapter verbs are in
[backends/github.md](backends/github.md).

**Linear backend:** there is no `board.sh`. Resolve the scope and apply actions
through the Linear MCP adapter verbs (`list_items` under the Completeness rule,
`get_issue`, `update_issue`, `create_comment`), exactly as the reused single-card
references already do. "Delete" means cancel/archive, not unlink. See
[backends/linear.md](backends/linear.md).

## Step 1 — Resolve the scope

Walk operates on a **candidate set**. The user describes the scope **in their own
words** — there is no query flag to type. Read their intent and resolve it with
the backend's underlying list/filter verbs. The board helper already supports
server-side filtering (`$HELPER list --query "<q>"`, e.g. `"status:Todo"`,
`"label:stale -status:Done"`); *you* construct that query from what the user
asked. The query string is an implementation detail of how you fetch, never
something the user supplies.

Map the request to a candidate set:

- **A milestone** ("walk the v0.4 milestone", "the milestone cards") → the
  milestone's open items via `list_milestone_items(<sel>, open)` (resolve the
  selector with `list_milestones`; see [milestone.md](milestone.md)). Milestone is
  a first-class named scope. On **github**, that verb returns repository issue
  rows, not project-item rows. Fetch the board once with `$HELPER list`, join the
  milestone issues to board cards by issue number, and preserve milestone order;
  exclude unmatched issues because they are not cards on this board, and report
  how many were excluded. On **linear**, milestone items already carry the issue
  ids used by the action verbs, so no join is needed.
- **A subset of the board** ("the Todo column", "everything labeled `stale`", "the
  blocked cards", "open bugs") → translate to the underlying filter:
  `$HELPER list --query "<q>"` on github (build the `status:` / `label:` /
  `-status:` query yourself), or `list_items` with the matching state/label filter
  on linear (under the Completeness rule).
- **No scope given** ("walk the board", bare `walk`) → default triage scope:
  everything **not** Done (`$HELPER list --query "-status:Done"`). This can be
  large; Step 2 confirms the count before looping.
- **Ambiguous** (a word that could name a milestone *or* a label, or a request you
  can't confidently map to a filter) → **list the interpretations and ask.** Never
  guess the scope — it changes every card you'll touch.

Resolve to an ordered in-memory list of cards. Fetch only what the block needs
(id, title, status, type, number, url, body preview, labels, milestone,
createdAt); pull the full body lazily on `more` via `get_item`, not up front for
every card. On **github**, `list_items` (`$HELPER list`) returns only the core
fields (`id,title,status,type,number,url,bodyPreview`) — pull `labels`,
`milestone`, and `createdAt` for the header from a supplementary
`gh issue list --repo "$REPO_OWNER/$REPO" --json number,labels,milestone,createdAt`
joined by issue number (the same source [milestone.md](milestone.md) /
[backends/github.md](backends/github.md) already use). On **linear**, `list_items`
can carry these directly.

**Ordering.** Default to the scope's natural order (board/column order, or
milestone item order). If the user asks for the most-urgent decisions first (e.g.
"walk the backlog, worst first"), order by "what's logically next" using the
[next.md](next.md) ranking judgment (milestone due date → priority/phase labels →
age).

**Codebase context.** By default walk enriches each card with a light read of the
codebase (Step 3) so decisions are informed by what the code actually shows. If
the user wants a fast, code-blind pass (e.g. "just walk them, skip the code
check"), skip Step 3 entirely.

## Step 2 — Announce the scope and confirm

Before looping, state what's about to be walked so the user can bail on a
too-broad scope:

```markdown
Walking **N cards** in <scope description> (order: <natural | most-urgent-first>).
Decisions apply as you go. Codebase context is gathered as you walk. `q` to stop anytime.
```

If the user asked to skip the codebase check, drop the "Codebase context…" clause.

- If `N` is 0: "Nothing in `<scope>` to walk." Stop.
- If `N` is large (say > 25) **and** the scope was the no-scope default: offer to
  narrow — "That's N cards. Want to narrow it (a column, a label, a milestone), or
  reply `go` to walk all N?" Don't force a walk through 100 cards the user didn't
  scope.

## Step 3 — Gather codebase context (as you walk)

Unless the user asked to skip it, each card is enriched with a **light** read of
the codebase so the user decides with the same evidence `review` would gather —
but distilled to **one line**, not a verdict. Two things the user cares about:
a card **already completed elsewhere** (the code reveals it shipped), and a card
whose **premise changed** (the file/approach it references was refactored or
deleted since the card was written).

**Reuse `review`'s evidence engine — do not reinvent it.** Gather signals exactly
as [review.md §"Gather codebase evidence per card"](review.md#2-gather-codebase-evidence-per-card):
recent commits matching the title (`git log --grep`), merged PRs referencing the
issue (`gh pr list --state merged --search`), whether files/symbols named in the
body exist (`rg`), linked PRs on the card, and issue-closed state. Spawn these as
cheap parallel `Bash` calls — don't deep-dive one card at a time.

**Fetch timing — rolling prefetch.** Don't stall the whole scope up front. Gather
context for the current card plus the next few while the user is deciding, with
bounded concurrency, so the walk stays snappy even on a large scope. A card whose
context isn't ready yet shows `Context: (gathering…)` and fills in.

**Distill to one tag + the single strongest signal.** Classify each card with a
tag from `review`'s verdict vocabulary, extended with a drift case:

| Tag | Means | Typical signal |
|---|---|---|
| `likely shipped` | done elsewhere | merged PR + matching commits + files exist |
| `partially landed` | some work in the tree | files/commits exist, no merged PR |
| `premise changed` | the card's basis drifted | a file/symbol the body names is **gone or heavily refactored** since the card was created |
| `not started` | nothing in the code | referenced files absent, no matching commits |
| `unclear` | no usable signal | show **nothing** rather than noise |

Use this evidence to add a concise **Suggested:** field. Recommend the smallest
useful change: usually a status move, a specific card update when the premise
changed, or `keep as-is` when no change is warranted. Never suggest deletion;
recommend Done or Cancelled instead. This remains a default, not an automatic
verdict: the user must accept it or choose another action.

Draft cards (title only) get title-keyword signals just like `review` handles
them. On the **linear** backend the evidence comes from the local git repo (same
regardless of tracker) plus the issue's linked branches/PRs — reuse review.md's
linear evidence note.

## Step 4 — The walk loop

For each card in order, print **one concise block**, then **stop and wait** for a
decision. Keep it tight — this is the whole point of walk. Do not dump the full
body unless the user asks (`more`).

```markdown
── [i/N] ────────────────────────────────────────────
**"<title>"**   ·   <Issue #n | Draft>   ·   <Status>
<age> old · milestone: <name or —> · labels: <csv or —> · linked PR: <#n or —>
Context: ⚑ <tag> — <one strongest signal>       ← omit if `unclear` or context is off
Suggested: <smallest warranted change | keep as-is>

> <body preview: first ~2 lines / ~200 chars, or "(no body)">

**[Enter]** accept suggestion  **[s]** status  **[u]** update  **[k]** keep  **[m]** more  **[q]** quit
```

The `Context:` line is **one line** — the tag plus the single strongest signal
(e.g. `⚑ likely shipped — merged PR #234, src/export/csv.ts exists`, or
`⚑ premise changed — src/legacy/auth.ts named in body was deleted in #300`). Omit
it entirely when the tag is `unclear` or context is off. The full evidence lives
behind `details` / `investigate`, not here — if the block scrolls, you've shown too much.

Show the full primary menu for each card. Keep it intentionally small:

| Key | Action |
|---|---|
| `Enter` / `accept` | Accept the `Suggested:` default. Status and keep-as-is suggestions apply immediately. Suggested edits first show the exact proposed diff and require the normal update approval. Never use Enter to delete. |
| `s` / `status` | Choose another status. If no target is inline, offer the columns (`done` / `progress` / `todo` / `backlog` / `cancel`). |
| `u` / `update` | Edit title, body, or status through [update.md](update.md), retaining its preview and explicit approval gate. |
| `k` / `keep` | Leave unchanged and advance, regardless of the suggestion. |
| `m` / `more` | Open the secondary action menu below; stay on this card. |
| `q` / `quit` | Stop the walk and print the tally. |

`m` means **more options**, not milestone. Show secondary actions as words so they
are clear and difficult to trigger accidentally:

```text
comment · milestone · decompose · investigate · open · details · delete
[b] back
```

- `comment`: add a comment; drafts require conversion to an issue first.
- `milestone`: reuse [milestone.md](milestone.md) `add`; github drafts have no milestone.
- `decompose`: reuse [decompose.md](decompose.md), then return to the card.
- `investigate`: deep-read this card's code paths, refine Context and Suggested,
  and stay on the card.
- `open`: print the card URL and stay on the card.
- `details`: show the full body and evidence, then stay on the card.
- `delete`: retain [delete.md](delete.md)'s consequences preview and typed `yes` gate.
- `b` / `back`: return to the primary menu.

Rules for the loop:

- **Apply direct non-destructive actions on the choice** (accepted status, status, comment,
  milestone) once any required target or text is known; don't add another
  confirmation afterward. Selecting **update** enters `update.md`'s per-card recipe
  and keeps its preview-and-explicit-approval gate. **Delete** likewise keeps the
  typed-`yes` gate from `delete.md`.
- **One card visible at a time.** Print the next block only after the current
  card's action resolves. Don't pre-render the whole scope.
- **Echo each decision as one line** so the walk leaves an auditable trail, e.g.
  `[3/12] #128 "Add retry jitter" → In Progress`.
- **Advance past a failed action; don't sink the walk.** If an action errors
  (network, unknown status), report it on that card's result line and stay on the
  card so the user can retry or skip. A *systemic* failure (auth lost, board
  unreachable) stops the walk — every remaining card would fail the same way.
- **The scope is a snapshot.** If an action changes a card's status such that it
  would leave the scope (e.g. a Todo-column walk and the user moves a card to
  Done), that's fine — the card was already loaded; just advance. Don't re-fetch
  the scope mid-walk.

## Step 5 — Tally

When the scope is exhausted or the user quits, print what changed:

```
Walked: M of N cards
  Status moves:   A   (→Done B, →In Progress C, →Todo D, cancelled E)
  Edited:         F
  Comments added: G
  Added to milestone: H
  Decomposed:     I
  Deleted:        J
  Skipped:        K
  Remaining (not reached): N − M
```

If the user quit early, name the next card so a re-run is obvious: "Stopped at
card 7/12. Re-run `/project walk <scope>` to continue from #<n>." (Walk has no
persistent cursor — it restarts at the scope's first card. Skipping already-handled
cards by hand, or narrowing the scope, resumes triage.)

## Edge cases

- **Empty scope.** Say so and stop. Don't widen to another column.
- **Single card in scope.** Still show the block + menu; the loop is just length 1.
- **Ambiguous bare positional** (matches a milestone *and* a label). List both
  interpretations and ask which — never guess the scope, it changes every card
  you'll touch.
- **Draft cards.** No comments, no milestone, can't be a sub-issue parent for
  `decompose` (checklist-only). When the user picks an action a draft can't take,
  say so on the result line and offer to convert it to an issue first (or skip) —
  don't silently no-op.
- **Decompose mid-walk.** Running `decompose` spawns child cards *outside* the
  current scope. Don't splice them into this walk — mention they were created and
  advance. The user can `/project walk <milestone>` again to include them.
- **Sensitive content when commenting/editing.** Before writing conversation
  context into a public board (github issues/comments are public), flag env vars /
  tokens / customer names and offer to strip them — same discipline as `update`.
- **Most-urgent-first asked but no ranking signals exist.** Fall back to board
  order silently (as [next.md](next.md) does) — note "(ranking signals unavailable
  — board order)".
- **User keeps hitting Enter.** Empty input accepts the displayed suggestion; it is
  never an implicit skip. Every card must display its suggestion before waiting.
- **Context can't be gathered** (evidence tools fail, or the card body names no
  code). Degrade to `unclear` and omit the `Context:` line — never block the walk
  or invent a signal. The user can still choose `m` → `investigate`.
- **Context contradicts the card's status** (tag `likely shipped` on a `Todo`
  card). Surface it in the one-line signal, but still let the user decide — walk
  reports, it doesn't auto-move. This is the everyday value of the feature.

## Guidelines

- **Concise is the contract.** Each card is one screen: header line, ~2-line body
  preview, key signals, the menu. `more` is opt-in. If a block scrolls, you've
  shown too much.
- **Reuse, don't reimplement.** Every action routes to an existing recipe
  (`update` / `milestone` / `decompose` / `delete` / `set_item_status`). If you're
  re-typing `gh issue edit` flags here, open the single-card reference instead.
- **Apply as you go; keep delete's gate.** The value of walk is deciding and
  landing each card in one beat. Only `delete` interrupts that with its typed
  confirmation — because it's irreversible.
- **One card at a time; the user drives.** Offer a suggested default, but do not apply it automatically. The user accepts or overrides every recommendation.
- **Suggest, never auto-decide.** Gather evidence like `review`, show one distilled
  line, and derive the smallest useful default action. Enter accepts that default;
  any other choice overrides it. Deeply investigate only when requested.
- **Respect the "move to Done, don't delete" norm.** If the user reaches for
  `delete` on a finished-looking card, push back once and offer `s done` instead.
- **Convert relative dates** ("today", "next sprint") to absolute before writing
  them into a card body or comment — they rot otherwise.
