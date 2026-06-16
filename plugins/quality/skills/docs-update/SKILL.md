---
name: docs-update
description: Audit project documentation against the current state of the codebase and produce a revision plan. Reads README and all docs, launches parallel Explore agents to verify claims, diffs documentation vs reality, and applies approved fixes. Use when user says "quality-docs-update", "update docs", "docs update", "check documentation", "audit docs", "fix readme", "documentation is outdated", or "sync docs with code".
---

# Documentation Update

Audit project documentation against the current state of the codebase and produce a structured revision plan.

## When to Use This Skill

Use this skill when the user explicitly requests:
- "Update docs"
- "Check documentation"
- "Audit the docs"
- "Fix the README"
- "Documentation is outdated"
- "Sync docs with code"
- "Review documentation accuracy"

**Important**: This skill runs only on explicit request.

---

## Phase 1: Discover Documentation

1. Find all documentation files in the project:
   - `README.md` (start here)
   - Any `docs/` directory
   - Other `.md` files that serve as documentation (exclude CLAUDE.md, CHANGELOG, LICENSE)
   - Inline doc references (e.g. links between docs, references to guides)
2. Read the README first to understand the project's stated purpose, setup instructions, API surface, and architecture.
3. Read all other documentation files found.
4. Build a map of what the documentation claims:
   - Project description and features
   - Installation / setup steps
   - Configuration options
   - API endpoints or public interfaces
   - Architecture and directory structure descriptions
   - Usage examples and code snippets
   - Dependencies mentioned

## Phase 2: Get Codebase Ground Truth

Launch multiple **Explore agents in parallel** to verify documentation claims against the actual codebase. Use these agents to answer:

- **Structure agent:** What is the actual directory structure and file organization? How does it compare to any architecture descriptions in the docs?
- **Setup agent:** What are the actual dependencies (package.json, requirements.txt, go.mod, etc.)? What environment variables are required? What are the actual build/run/test commands? Do the documented setup steps actually work?
- **API/Interface agent:** What are the actual public APIs, exported functions, CLI commands, or endpoints? Do documented examples and signatures match the code?
- **Features agent:** What features exist in the code that are undocumented? What documented features no longer exist or have changed significantly?

Adapt the agents to the project type. Skip agents that aren't relevant (e.g., skip API agent for a pure library with no endpoints).

## Phase 3: Produce Revision Plan

Compare the documentation claims (Phase 1) against the codebase ground truth (Phase 2). Produce a structured revision plan organized by file:

For each documentation file that needs changes:

```
## [filename]

### Outdated
- [What's wrong] → [What it should say] (evidence: [file or code reference])

### Missing
- [What should be added] (evidence: [file or code reference])

### Incorrect
- [What's wrong] → [What's correct] (evidence: [file or code reference])

### Remove
- [What should be removed] (reason: [why it's no longer relevant])
```

## Phase 4: Confirm and Execute

Present the revision plan to the user. Ask which revisions to proceed with:
- **All** — apply everything
- **Select** — let the user pick specific items
- **None** — just keep the plan as reference

Apply approved revisions, preserving the existing documentation style and tone. Do not rewrite sections that are already accurate. Make surgical edits, not full rewrites.

## Notes

- Prioritize accuracy over completeness. Wrong docs are worse than missing docs.
- Preserve the project's existing voice and formatting conventions.
- Flag any docs that reference external services, URLs, or versions that can't be verified from the codebase alone — note these as "needs manual verification."
- If the project has no documentation at all, propose a minimal README structure instead of a revision plan.
