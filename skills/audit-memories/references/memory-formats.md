# Memory store reference

Where agents keep file-based memories, what the files look like, and the
heuristics for flagging a memory as problematic. **Verify locations before
acting** — agents change layouts often.

## Where memories live

### Claude Code (primary target)

Claude Code keeps an auto-memory store **per project**:

```
~/.claude/projects/<encoded-cwd>/memory/
├── MEMORY.md          # index: one bullet per memory (loaded each session)
└── <slug>.md          # one file per memory, with YAML frontmatter
```

The `<encoded-cwd>` is the project's absolute path with every non-alphanumeric
character (including `/` **and** `.`) replaced by `-` (e.g. `/Users/alice/proj`
→ `-Users-alice-proj`, and `/Users/alice/.config/app` → `-Users-alice--config-app`
— note the `--` from `/.`). The memory dir for the *current* project is therefore
`~/.claude/projects/$(pwd | sed 's|[^a-zA-Z0-9]|-|g')/memory`.

A user-scoped store may also exist at `~/.claude/memory/`. To find every store
regardless of encoding:

```bash
find ~/.claude/projects -maxdepth 2 -type d -name memory
```

**Memory file schema** (what `scan-memories.sh` parses):

```markdown
---
name: <kebab-case-slug>
description: <one-line summary — used for recall relevance>
metadata:
  type: user | feedback | project | reference
  # older/other stores may also carry: node_type, originSessionId
---

<the fact. For feedback/project, follow with **Why:** and **How to apply:** lines.
Links to related memories use [[other-name]] wikilink syntax.>
```

**Type taxonomy:**
- `user` — who the user is (role, expertise, durable preferences).
- `feedback` — guidance on how the agent should work; includes the *why*.
- `project` — ongoing work/goals/constraints not derivable from the code or git.
- `reference` — pointers to external resources (URLs, dashboards, tickets).

**MEMORY.md** is the index loaded into context every session. Each memory should
have exactly one line there: `- [Title](file.md) — hook`. A file with no index
line is invisible to recall (orphan file); an index line with no backing file is
a dangling pointer.

### Other agents

| Agent       | Memory surface                          | File-accessible? |
|-------------|-----------------------------------------|------------------|
| Codex CLI   | `AGENTS.md` (project/user), `~/.codex/`  | Yes (prose, not a per-fact store) |
| Cursor      | "Memories" feature                      | No — stored in an internal DB, not plain files; audit via the Cursor UI |
| CLAUDE.md   | `./CLAUDE.md`, `~/.claude/CLAUDE.md`    | Yes — instruction memory, secondary scope (see below) |

Most agents don't ship a per-fact file store like Claude Code's auto-memory.
For those, the audit degrades to reviewing the relevant prose file(s)
(`AGENTS.md`, `CLAUDE.md`) for stale or contradictory instructions, or — for
Cursor — pointing the user at their in-app memory list.

**CLAUDE.md / AGENTS.md as memory.** Claude Code's `#` shortcut appends "memory"
lines to `CLAUDE.md`. These are instruction memory, not the per-fact store. Only
audit them when the user asks to include CLAUDE.md — and edit conservatively:
these files are usually version-controlled and shared with a team, so removing a
line is a code change, not a private cleanup.

## Flagging heuristics

Sort the inventory oldest-first (the scan script does this) — age correlates
with staleness but never proves it. Each category below is a *candidate* signal,
not a verdict. Confirm before proposing removal.

| Category | Signal | How to confirm |
|---|---|---|
| **Stale / out-of-date** | Cites a file, function, flag, path, version, or behavior | Grep/read the repo for the cited symbol. Gone or changed → confirmed stale. |
| **Contradictory** | Two memories give conflicting guidance | Quote both; ask the user which holds, or check which the code/repo supports. |
| **Superseded** | A newer memory restates/overrides an older one | Compare timestamps + content; the older one usually merges into the newer. |
| **Redundant / duplicate** | Near-identical content across two files | Diff them; merge into one, keep the richer wording. |
| **Already-captured** | The fact lives in CLAUDE.md, the code, or git history | The memory guidance says don't store these. Confirm the canonical source still says it, then drop the memory. |
| **Ephemeral / over-scoped** | Mattered to one past conversation, not a durable fact | Read the body — if it reads like a one-off task note, propose removal. |
| **Vague / unverifiable** | Too generic to act on ("be careful with configs") | Propose rewrite into something concrete, or removal. |
| **Orphan file** | Memory file not referenced in MEMORY.md (`INDEXED=no`) | Either add an index line or remove the file — it's currently dead. |
| **Dangling index line** | MEMORY.md bullet with no backing file | Remove the bullet. |
| **Malformed** | Missing `name`/`description`/`type`, broken frontmatter | Fix the frontmatter or flag for the user. |
| **Dead wikilink** | `[[name]]` pointing at a memory that no longer exists | Repoint or remove the link (note: an unresolved `[[name]]` can also be an intentional placeholder for a memory not yet written). |

### The verification rule

Memories are **point-in-time observations**. A memory saying "function X lives in
foo.ts" was true when written. Before calling it stale, check the *current* repo.
Never assert "this is out of date" from the memory text alone — that's how a
correct memory gets deleted because the auditor guessed. When you can't verify
(e.g. it references a private system you can't see), say so and let the user
decide rather than flagging it for removal.
