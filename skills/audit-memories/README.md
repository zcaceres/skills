# audit-memories

A guided review for an AI agent's saved memories. Over time a memory store
collects rot — facts that point at code that has since moved, memories that
contradict each other, near-duplicates, one-off notes that were never durable,
and files that drifted out of the index. This skill makes that rot visible and
walks the user through fixing it, one memory at a time.

It **curates, it does not purge**: the agent proposes, the user disposes, and
nothing is deleted without per-item confirmation.

## What it does

1. **Locate & scope** — finds the memory store(s) (default: Claude Code's
   per-project `~/.claude/projects/<cwd>/memory/`) and confirms what to audit.
2. **Overview** — `scripts/scan-memories.sh` inventories the store from
   frontmatter only (cheap for large stores): counts by type, age buckets, and
   orphan detection, one row per memory sorted oldest-first.
3. **Flag** — applies staleness/contradiction/duplicate/orphan heuristics,
   **verifying citations against the current repo** before flagging, and presents
   a severity-grouped triage list with evidence.
4. **Drill in & decide** — shows full bodies on request; offers keep / update /
   merge / delete per item.
5. **Apply & reconcile** — makes approved edits, keeps `MEMORY.md` and
   `[[wikilinks]]` in sync, and backs the store up before any deletion.

See [SKILL.md](./SKILL.md) for the workflow and safety rails, and
[`references/memory-formats.md`](./references/memory-formats.md) for per-agent
store locations, the frontmatter schema, and the full heuristics table.

## Layout

- `SKILL.md` — manifest + instructions (skills.sh standard)
- `scripts/scan-memories.sh` — frontmatter-only inventory + orphan check (no deps beyond bash + perl)
- `references/memory-formats.md` — store locations, schema, flagging heuristics

## Install

```
npx skills add zcaceres/skills -s audit-memories
```

Add `-g` for global install, or `-a <agent>` to target a specific agent.

Pure-markdown + one bash script — no binaries, no install-time side effects.
