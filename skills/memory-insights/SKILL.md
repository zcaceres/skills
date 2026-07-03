---
name: memory-insights
description: Read the agent's file-based memory (the current project by default, or all projects on request), then give the user a few one-sentence, non-obvious pieces of feedback — constructive or observational — about themselves. Use when the user says "memory insights", "what do you notice about me", "read my memory and tell me something I don't know", or "/memory-insights".
---

# memory-insights

The prompt behind this skill: read everything the agent remembers about the
user, then hand back a few one-sentence pieces of feedback — constructive or
observational — that aren't obvious to them.

## How

1. Gather the corpus:

   ```bash
   skills/memory-insights/scripts/gather-memories.sh          # this project (default)
   skills/memory-insights/scripts/gather-memories.sh --all    # every project + global
   ```

   It dumps full memory bodies into one stream. Read the whole thing. Default is
   the current project's store; reach for `--all` when the user wants a
   cross-project read or the current project is thin. If auto-detect misses the
   project, pass the memory dir with `--dir <path>` (you know it from context).

2. Read *through* the memories to the person. The store is mostly operational —
   corrections, project notes, references — but you're not summarizing the store.
   You're inferring the human behind it: their temperament, their values, their
   instincts, their blind spots. What would a perceptive colleague notice after
   reading all of this that the user can't see about themselves?

3. Give 3–5 insights. Each one sentence, non-obvious, constructive or
   observational. Lead with them, no preamble. Then stop.

## Keep it honest

- **Read to the person, not the store.** If a finding is about memory hygiene or
  the git workflow rather than the human, cut it.
- **Don't flatter, don't fabricate.** Every insight traces to something real in
  the corpus, even when you don't cite it.
- **Non-obvious is the bar.** If it would make them nod and move on, drop it.
  Keep the ones that make them pause.
