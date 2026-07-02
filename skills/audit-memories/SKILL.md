---
name: audit-memories
description: Audit an AI agent's saved memories — inventory them by type and age, flag the ones that look stale, contradictory, redundant, or orphaned (verified against the current repo), then walk the user through keep/update/merge/delete decisions one at a time. Default target is Claude Code's per-project memory store (~/.claude/projects/<cwd>/memory/), but handles any file-based memory dir. Use when the user says "audit my memories", "prune memories", "clean up my Claude memories", "review memories", "my memory is cluttered/stale", or "/audit-memories". Curates — it never bulk-deletes.
---

# audit-memories

Help the user **review and curate** an agent's saved memories. The job is not to
empty the store — it's to surface the memories that have rotted (gone stale,
started contradicting each other, piled up as duplicates, or fallen out of the
index) so the user can decide, item by item, what to keep, fix, or drop.

You **propose**; the user **disposes**. Never delete a memory without explicit
per-item confirmation, and never delete in bulk.

## Mental model

A memory store is a folder of small markdown files plus an index. Over months it
accumulates cruft: facts that pointed at code that has since moved, two memories
that now disagree, near-duplicates, one-off notes that were never durable, and
files that drifted out of the index. None of that is visible at a glance — recall
just quietly surfaces worse and worse context. This skill makes the rot visible
and gives the user a controlled way to clean it.

See [`references/memory-formats.md`](references/memory-formats.md) for store
locations per agent, the frontmatter schema, the type taxonomy, and the full
flagging heuristics table. Read it before the analysis phase.

## Workflow

Run these phases in order. Stop and show the user the output of each phase before
moving on — this is a guided review, not a batch job.

**Keep the report scannable.** A glance is the point. The overview is one line; the
triage is a one-row-per-finding table; healthy memories are a count, never a list.
Reserve full bodies, evidence write-ups, and reasoning for Phase 3 — and only for
the memories the user chooses to open.

### Phase 0 — Locate the store(s) and confirm scope

Find the memory directories, then confirm with the user which to audit before
touching anything.

```bash
# Current project's Claude memory store:
skills/audit-memories/scripts/scan-memories.sh
# Every Claude/Codex store on this machine:
skills/audit-memories/scripts/scan-memories.sh --all
# A specific store:
skills/audit-memories/scripts/scan-memories.sh --dir <path>
```

(Use the script's installed path; it lives in this skill's `scripts/` dir.)

If discovery finds nothing for the current project, run `--all` and let the user
pick — the per-project encoding (each non-alphanumeric char → `-`) means the
active store may belong to a different cwd than the one you're in. Confirm: **this project only, or global
too? Which agent(s)?** If the user wants CLAUDE.md / AGENTS.md included, treat
those conservatively (they're usually version-controlled and team-shared — see
the reference doc).

### Phase 1 — Overview (inventory by type)

Run `scan-memories.sh` for the chosen store(s) and present the summary first.
It emits, per directory:

- a summary line: total count, **counts by type** (`user`/`feedback`/`project`/
  `reference`), age buckets, and an orphan count (`NOT-in-index`);
- one TSV row per memory, **sorted oldest-first**, with age, size, whether it's
  in the index, type, name, file, and the one-line description.

Compress it into **one dense line**, not a paragraph or a table:

```
8 memories · feedback 5 · reference 2 · project 1 · index 5/8 (3 orphans) · all <30d
```

That's the whole "what's in here" picture. The script reads only frontmatter, so
it's cheap even for large stores — but don't read full bodies yet, and don't
enumerate the healthy memories.

### Phase 2 — Flag what looks problematic

Apply the heuristics from the reference doc to produce a **triage list** — but
verify before you flag. Go through the categories:

- **Stale** — for any memory citing a file, symbol, flag, path, or version,
  grep/read the *current* repo to check it still holds. Confirmed-gone → flag.
  (For large stores, parallel `Explore` agents can do this verification fan-out;
  keep it lightweight for small ones.)
- **Contradictory / superseded** — compare memories pairwise within a topic;
  surface conflicts and newer-overrides-older pairs.
- **Redundant** — spot near-duplicates.
- **Already-captured** — facts the memory guidelines say not to store (live in
  the code, git history, or CLAUDE.md).
- **Ephemeral / vague** — one-off task notes or guidance too generic to act on.
- **Structural** — orphan files (`INDEXED=no`), dangling index lines, malformed
  frontmatter, dead `[[wikilinks]]`.

Present the result as a **compact table — one row per flagged memory, nothing
else**. Severity 🔴 (act) / 🟡 (look); `issue → action` in a few words; evidence
is a terse inline citation (`file:line`, `gone`, `dup of X`), not a sentence. Roll
the healthy memories into a single trailing count — never list them.

```
8 memories · 4 flagged · 0 to delete

🔴 reference_..._hooks_scope.md      orphan → add to index
🔴 reference_skills_cli_install.md   orphan → add to index
🔴 feedback_install_via_symlink.md   orphan → add to index
🟡 project_codex_guard.md            task shipped (index.ts:105); index line contradicts body → update→reference

✓ 4 verified current
```

No prose paragraphs, no per-finding write-ups, no quoting bodies — that detail is
Phase 3, and only for the items the user drills into. If a finding genuinely needs
a sentence to be safe to act on, add one short parenthetical, not a section.

**Do not act in this phase.** Flagging ≠ deleting. The
[verification rule](references/memory-formats.md) is binding: a memory is a
point-in-time note; if you can't confirm it's wrong against the current repo, say
so and leave the decision to the user rather than flagging it for removal.

### Phase 3 — Drill in and decide, one at a time

Now go interactive. For each flagged item (or any memory the user asks to see),
show the **full body**, the reason it was flagged, and the supporting evidence.
Then offer the choices and wait for the user:

- **Keep** — clear the flag, leave it untouched.
- **Update** — rewrite the body to reflect current reality (preserve the
  `name`/frontmatter and any provenance like `originSessionId`). Prefer this over
  deleting whenever the memory is salvageable.
- **Merge** — fold a duplicate into its sibling; keep the richer wording; delete
  the now-empty file and reconcile both index lines.
- **Delete** — only on explicit confirmation for *that* file.

Let the user also browse non-flagged memories — offer to dump any by name. The
user drives; don't rush to the next item.

### Phase 4 — Apply and reconcile the index

- **Re-scan immediately before editing.** The store may have changed since Phase 1
  — a live agent session (possibly this one) can add, rewrite, or re-index
  memories mid-audit. Re-run `scan-memories.sh` and re-read `MEMORY.md` right
  before you touch anything, and confirm each target file still exists and still
  has the problem you flagged. If the store shifted materially, re-triage rather
  than applying stale findings. See the live-store rail below.

Then make the approved edits and deletions, keeping the store consistent:

- **MEMORY.md is the source of truth for recall.** After every delete/rename,
  remove or rewrite its bullet. After fixing an orphan, add the missing bullet.
  Edit in place — preserve the bullets the subsystem added; never regenerate the
  whole index from your own snapshot.
- Repoint or remove any `[[wikilinks]]` that pointed at a deleted/renamed memory.
- Re-run `scan-memories.sh` to confirm the orphan/dangling counts dropped to the
  expected numbers.
- Summarize what changed: kept N, updated N, merged N, deleted N — and list the
  deletions by name.

## Safety rails

- **Curate, don't purge.** The goal is a cleaner store, not an empty one. If most
  memories check out, say so — a short flagged list is a good outcome.
- **Per-item confirmation for every deletion.** Never delete in bulk, never
  delete a memory the user hasn't seen the full body of.
- **Update beats delete** when a memory is salvageable.
- **Verify staleness against the current repo** before asserting it. Don't delete
  a correct memory because its text *looked* outdated.
- **Back up before destructive edits.** Memory stores usually aren't in git, so
  there's no undo. Before the first deletion, copy the store aside:
  `cp -R <store> <store>.audit-backup-<date>` — and tell the user where it went.
  Don't use `rm`; if a trash CLI is available, prefer it.
- **Beware the live store.** A memory store is often being written *right now* by
  an active agent session — the memory subsystem adds and re-indexes memories
  mid-conversation. Editing it then risks a write race: your change and the
  subsystem's next write can clobber each other. If a scan shows the store moving
  under you (file count or index changing between scans), say so and prefer to
  apply when it's quiescent — e.g. not from inside a live session on that same
  project. When you do edit, re-scan first (Phase 4) and make the smallest
  in-place change, so a lost race costs one bullet, not the whole index.
- **CLAUDE.md / AGENTS.md are team artifacts.** Editing them is a code change —
  diff, don't silently rewrite, and let the user commit.
