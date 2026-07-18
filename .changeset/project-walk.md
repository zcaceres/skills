---
"@zcaceres/skill-project": minor
---

Add a `walk` subcommand: walk a scoped set of cards one at a time for hands-on triage/grooming. Each card gets a concise block (title, status, key signals, short body preview) and a compact decision menu — status move / edit / comment / add-to-milestone / decompose / delete / dig / skip / open / more — applied per card as you go. Scope comes from a milestone, `--query`, `--label`, `--status`, a bare selector, or defaults to everything not-Done; `--ranked` orders by the `next` ranking.

Decisions are informed by the codebase: by default each card carries a light context signal — reusing `review`'s evidence engine (git-log grep, merged-PR search, file/symbol existence, linked PRs) distilled to one line — that flags when a card was likely completed elsewhere or when its premise drifted (a file/approach it references was refactored or deleted). Unlike `review`, walk surfaces the signal rather than proposing a verdict; the user still drives every decision. `dig` escalates a single card to deep Explore-agent reasoning on demand; `--no-context` skips evidence for a fast code-blind pass.

It's an envelope that reuses the per-card recipes from update / milestone / decompose / delete and keeps every single-card safety rule (typed `yes` on delete, the "move finished cards to Done, don't delete" norm). Distinct from `next` (picks one to work on), `review` (evidence-driven audit with per-card approval), and `batch` (same change across many). Backend-neutral: the linear backend resolves the scope, gathers evidence from the local git repo plus linked PRs, and applies through the Linear MCP.
