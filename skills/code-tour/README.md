# code-tour

Claude Code skill that walks an unfamiliar codebase and writes a concise
`CODE_TOUR.md` — an onboarding map covering what the project is, the handful of
components that matter, a Mermaid diagram of how they connect, and the spots
worth a closer look. Orients from the README and package manifests, fans out
parallel Explore agents to gather ground truth, then synthesises one tight
document with clickable `file:line` breadcrumbs.

It is read-mostly: it explores the code and writes exactly one artifact
(`CODE_TOUR.md` at the repo root). It does not modify source code.

**Usage:** `/code-tour`

See [SKILL.md](./SKILL.md) for the phase-by-phase workflow and the output
template.

## Install

```sh
npx skills add zcaceres/skills -s code-tour
```
