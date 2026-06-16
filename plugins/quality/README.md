# quality (Claude Code plugin)

Code-quality analysis: chaos-monkey bug hunting, dead-code/duplication detection, perf review, docs audits, CLI agent-friendliness, and project-health scoring.

| Skill | What it does |
|---|---|
| `/quality:chaos-monkey` | Trace code paths to find bugs, logic errors, race conditions. |
| `/quality:cli-agent-friendly-audit` | Audit a CLI tool against the agent-friendliness checklist from Zbigniew Sobiecki's "Building Agent-Friendly CLIs". |
| `/quality:dead-code-analyzer` | Analyze a codebase for dead code, duplicates, and circular dependencies using knip, jscpd, and madge, then validate… |
| `/quality:docs-update` | Audit project documentation against the current state of the codebase and produce a revision plan. |
| `/quality:perf-review` | Analyze a codebase for performance bottlenecks in full-stack web applications. |
| `/quality:project-health` | Assess the current project's repo and work-tracker status, then rate overall project health from 0-10. |

## Install

```shell
/plugin marketplace add zcaceres/skills
/plugin install quality@zcaceres-skills
```

## Develop / test locally

```bash
claude --plugin-dir ./plugins/quality
/reload-plugins   # after edits
```

> Generated from `skills/quality-*` by `bun run build:plugins`. Edit the originals under `skills/`, not these copies.
