# memory-insights

Reads everything the agent remembers about you — the current project's memory
store by default, or *every* project's on request — then hands back a few
one-sentence pieces of feedback, constructive or observational, that aren't
obvious to you.

The point is to read *through* the memories to the person. The store is mostly
operational (corrections, project notes), so the skill infers the human behind
it: temperament, values, instincts, blind spots — what a perceptive colleague
would notice after reading all of it.

## How it works

1. `scripts/gather-memories.sh` dumps full memory bodies into one stream —
   the current project's `~/.claude/projects/<proj>/memory/` store by default,
   or every project (plus the global one) with `--all`.
2. The agent reads the whole corpus and returns 3–5 non-obvious, one-sentence
   insights about you. Read-only — it never edits or deletes a memory.

For pruning a cluttered store, use `audit-memories`; for a single-session
retrospective, `reflect-on-conversation`.

See [SKILL.md](./SKILL.md).

## Layout

- `SKILL.md` — manifest + instructions (skills.sh standard)
- `scripts/gather-memories.sh` — cross-project memory dump (bash + perl, no deps)

## Install

```
npx skills add zcaceres/skills -s memory-insights
```

Add `-g` for global install, or `-a <agent>` to target a specific agent.

Pure-markdown + one bash script — no binaries, no install-time side effects.
