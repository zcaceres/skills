# `/project walk` — Triage a Scope of Cards One by One

You are walking the user through a **scoped set** of board cards, one at a time,
in a tight decision loop. For each card you print a **concise** block — enough to
judge it, not the whole body — then offer a compact **decision menu** and apply
the pick immediately before advancing to the next card.

This is **interactive triage / grooming**, not work-picking and not auditing:

- Unlike [`next`](next.md), walk does not stop at one card to start work on it —
  it moves through the *whole scope* so the user can groom it.
- Like [`review`](review.md), walk reads the codebase to inform each card — but it
  distills the evidence to a **one-line signal** and lets the **user** decide,
  rather than proposing a status verdict and asking approval per card. Walk is the
  fast hands-on grooming pass; `review` is the evidence-driven reconciliation.
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
- "/project walk <milestone | --query … | --label … | --status …>"

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

Walk operates on a **candidate set** derived from the argument. Parse the
subcommand arguments and resolve in this order:

| Argument form | Scope |
|---|---|
| `--query "<q>"` | board query, verbatim — `$HELPER list --query "<q>"` (github) / `list_items` filtered (linear). |
| `--label <name>` | sugar for `--query "label:<name> -status:Done"`. |
| `--status <col>` | sugar for `--query "status:<col>"` (walk a single column, e.g. `--status Todo`). |
| `--milestone <sel>` or `milestone <sel>` | the milestone's open items — `list_milestone_items(<sel>, open)` (see [milestone.md](milestone.md)). |
| a bare positional token (e.g. `walk v0.4`) | resolve heuristically: try it as a **milestone** name first (`list_milestones`), then a **label**, then a **status column**. If it cleanly matches exactly one interpretation, use it. If it matches more than one (a milestone *and* a label named `v0.4`), **list the interpretations and ask** — don't guess. |
| **empty** (`walk` with no arg) | default triage scope: everything **not** Done — `$HELPER list --query "-status:Done"`. This can be large; Step 2 confirms the count before looping. |

Resolve to an ordered in-memory list of cards. Fetch only what the block needs
(id, title, status, type, number, url, body preview, labels, milestone,
createdAt); pull the full body lazily on `more` via `get_item`, not up front for
every card.

**Ordering.** Default to the scope's natural order (board/column order, or
milestone item order). Pass `--ranked` to order by "what's logically next" using
the [next.md](next.md) ranking judgment (milestone due date → priority/phase
labels → age) — useful when triaging a big backlog and you want the most-urgent
decisions first.

**Codebase context.** By default walk enriches each card with a light read of the
codebase (Step 3) so decisions are informed by what the code actually shows.
Pass `--no-context` to skip that entirely for a fast, code-blind triage pass.

## Step 2 — Announce the scope and confirm

Before looping, state what's about to be walked so the user can bail on a
too-broad scope:

```markdown
Walking **N cards** in <scope description> (order: <board | ranked>).
Decisions apply as you go. Codebase context is gathered as you walk. `q` to stop anytime.
```

If `--no-context` was passed, drop the "Codebase context…" clause.

- If `N` is 0: "Nothing in `<scope>` to walk." Stop.
- If `N` is large (say > 25) **and** the scope was the empty-arg default: offer to
  narrow — "That's N cards. Narrow with `--status Todo`, `--label …`, or a
  milestone, or reply `go` to walk all N." Don't force a walk through 100 cards
  the user didn't scope.

## Step 3 — Gather codebase context (as you walk)

Unless `--no-context` was passed, each card is enriched with a **light** read of
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

This is a **signal, not a verdict.** Walk surfaces the tag and lets the user pick
any menu action — it does **not** propose a status move and ask approval. That
proposal-and-approval loop is `review`'s job; keep walk's lighter contract.

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
Context: ⚑ <tag> — <one strongest signal>       ← omit this line if tag is `unclear` or --no-context

> <body preview: first ~2 lines / ~200 chars, or "(no body)">

**[s]** status  **[e]** edit  **[c]** comment  **[m]** milestone  **[x]** decompose  **[d]** delete  **[g]** dig  **[k]** skip  **[o]** open  **[more]** full body  **[q]** quit
```

The `Context:` line is **one line** — the tag plus the single strongest signal
(e.g. `⚑ likely shipped — merged PR #234, src/export/csv.ts exists`, or
`⚑ premise changed — src/legacy/auth.ts named in body was deleted in #300`). Omit
it entirely when the tag is `unclear` or context is off. The full evidence lives
behind `more` / `dig`, not here — if the block scrolls, you've shown too much.

Show the menu once at the top of the loop in full; on later cards you may abbreviate
it to a single hint line (`s/e/c/m/x/d/k/o/more/q`) to keep the walk scannable.

### Decision keys

Accept the single letter, the full word, or an inline argument form (e.g. `s done`,
`m v0.4`). Apply, echo a one-line result, then advance to card `i+1`.

| Key | Action | Recipe |
|---|---|---|
| `s` / `status` | Move the card's status. If no target given, offer the columns (`done` / `progress` / `todo` / `backlog` / `cancel`); `s done` skips the prompt. | `set_item_status(id, <canonical>)` — github: `$HELPER set-status "$ID" "<native>"`. |
| `e` / `edit` | Edit title / body / status, folding in conversation context. | [update.md](update.md) — run its per-card recipe inline, then return to this card's result line. |
| `c` / `comment` | Add a comment. Prompt for the text if not given inline. | github: `gh issue comment <n> --repo "$REPO_OWNER/$REPO" --body "…"`; linear: `create_comment(id, body)`. **Drafts have no comments** — say so and offer to convert to an issue or skip. |
| `m` / `milestone` | Add the card to a milestone. | [milestone.md](milestone.md) `add`. Issues only on github (drafts have no milestone field). |
| `x` / `decompose` | Split this card into subtasks. | [decompose.md](decompose.md) — run its propose-and-refine loop, then return here. This card usually then becomes `skip`/`done` (its children carry the work). |
| `d` / `delete` | Remove the card. **Keeps delete's full gate** — show consequences (draft = destroyed; issue = unlinked, stays open; linear = cancelled/archived) and require a typed `yes`. | [delete.md](delete.md). |
| `g` / `dig` / `deep` / `investigate` | Escalate **this** card beyond the light signals: spawn an `Explore` agent to reason about whether the work already shipped or the premise drifted, reading the actual code paths the card touches. Print its finding, refine the `Context:` tag, stay on the card, re-offer the menu. Pay for deep reasoning only on the cards that warrant it. | `Explore` agent scoped to the card's title/body keywords + referenced paths. |
| `k` / `skip` / `` (Enter) | Leave unchanged, advance. | — |
| `o` / `open` | Print the card URL (and note it's clickable). Stay on this card. | — |
| `more` / `why` | Dump the full body (`get_item`), the **full evidence** behind the `Context:` tag (the code refs, commits, PRs — like review's evidence list), plus comments count / last comment and any linked PRs. Stay on this card, re-offer the menu. | `get_item(id)` + the Step 3 signals. |
| `b` / `back` | Re-show the previous card to revise a decision. | — |
| `q` / `quit` / `done` | Stop the walk. Go to Step 5 (tally). | — |

Rules for the loop:

- **Apply non-destructive actions on the keystroke** (status, comment, milestone,
  edit). Confirming each would defeat the concision walk exists for. **Delete is
  the exception** — it keeps the typed-`yes` gate from `delete.md`.
- **One card visible at a time.** Print the next block only after the current
  card's action resolves. Don't pre-render the whole scope.
- **Echo each decision as one line** so the walk leaves an auditable trail, e.g.
  `[3/12] #128 "Add retry jitter" → In Progress`.
- **Advance past a failed action; don't sink the walk.** If an action errors
  (network, unknown status), report it on that card's result line and stay on the
  card so the user can retry or skip. A *systemic* failure (auth lost, board
  unreachable) stops the walk — every remaining card would fail the same way.
- **The scope is a snapshot.** If an action changes a card's status such that it
  would leave the scope (e.g. `--status Todo` walk and the user moves a card to
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
- **`--ranked` with no ranking signals.** Fall back to board order silently (as
  [next.md](next.md) does) — note "(ranking signals unavailable — board order)".
- **User keeps hitting Enter.** Empty input = `skip`. A fast Enter-Enter-Enter run
  is a valid way to page through a scope read-only; that's fine.
- **Context can't be gathered** (evidence tools fail, or the card body names no
  code). Degrade to `unclear` and omit the `Context:` line — never block the walk
  or invent a signal. The user can still `dig` a card by hand.
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
- **One card at a time; the user drives.** Don't propose verdicts (that's
  `review`) and don't pick for them. Walk presents; the user decides.
- **Context is a signal, not a verdict.** Gather evidence like `review`, but show
  one distilled line and let the user act — never fold it into review's
  propose-and-approve loop. Light by default; `dig` a specific card only when it
  warrants a closer read.
- **Respect the "move to Done, don't delete" norm.** If the user reaches for
  `delete` on a finished-looking card, push back once and offer `s done` instead.
- **Convert relative dates** ("today", "next sprint") to absolute before writing
  them into a card body or comment — they rot otherwise.
