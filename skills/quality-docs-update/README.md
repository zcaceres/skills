# quality-docs-update

Claude Code slash command that audits project documentation against the
current state of the codebase and produces a structured revision plan, then
applies the fixes you approve. Reads the README and all docs, launches
parallel Explore agents to verify claims against the code, diffs documentation
vs reality, and makes surgical edits.

**Usage:** `/quality-docs-update`

See [SKILL.md](./SKILL.md) for the phase-by-phase workflow and the revision
plan format.

## Install

```sh
npx skills add zcaceres/skills -s quality-docs-update
```
