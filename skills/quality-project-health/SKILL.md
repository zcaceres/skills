---
name: quality-project-health
description: Assess the current project's repo and work-tracker status, then rate overall project health from 0-10. Invoke via /quality-project-health.
argument-hint: "[focus]"
disable-model-invocation: true
---

# Quality Project Health

Answer the Claude command this skill ports:

> What's the status of this project? Rate it on a quality level of 0-10.

**Usage:** `/quality-project-health [focus]`

`focus` is optional. If present, use it to bias the inspection toward a
subsystem, feature, skill, package, or task. Do not edit files.

## Workflow

Gather evidence before rating. Keep commands read-only unless the user
explicitly asks for follow-up work.

1. Identify the project root and current branch.
2. Inspect git state:
   - `git status --short --branch`
   - `git diff --stat origin/main...` when `origin/main` exists
   - `git log --oneline --decorate --max-count=8 --graph --all`
3. Identify the project type from files such as `package.json`,
   `pyproject.toml`, `Cargo.toml`, `go.mod`, `README*`, `CLAUDE.md`, and
   `AGENTS.md`.
4. Run the cheapest relevant validation command if it is obvious from the
   repo. Examples: `bun run check`, `npm test`, `pytest`, `cargo test`,
   `go test ./...`. If validation would be expensive or destructive, skip it
   and say why.
5. If `.project/config.json` and `.project/scripts/board.sh` exist (or the
   legacy `.github/gh-project.json` + `.github/scripts/gh-project-board.sh`),
   use the helper for a read-only board snapshot:
   - list all items and count by status
   - list current `In Progress` cards
   - mention the next few `Todo` cards only if it helps orient the user
6. If there are local notes in `.context/`, read only files that look relevant
   to the status request, such as `todos.md`.

## Health Rating

Rate project health from 0-10 using concrete evidence:

- **0-2:** not runnable or largely missing; core purpose unclear
- **3-4:** recognizable shape, but major blockers, failing checks, or missing
  foundations
- **5-6:** usable but uneven; important gaps, stale tasks, or weak validation
- **7-8:** healthy and shippable for current scope; some known follow-up work
- **9:** polished, well-tested, documented, and actively maintained
- **10:** exceptional: comprehensive validation, clean backlog, strong docs,
  mature release path, and no material unknowns

Do not give a high score just because the working tree is clean. Consider
tests, docs, release readiness, task-board health, and unresolved work.

## Output

Keep the final answer compact and evidence-led:

1. Current status: branch, diff cleanliness, validation result.
2. Work tracker status: counts and active work, if available.
3. Quality rating: `N/10` with 2-4 reasons.
4. Main risks or gaps.
5. Recommended next action.

If a check could not be run, say so directly. Do not imply certainty beyond
the evidence gathered.
