---
"@zcaceres/skill-quality-chaos-monkey": major
"@zcaceres/skill-quality-dead-code-analyzer": major
"@zcaceres/skill-quality-perf-review": major
---

Group the code-quality skills under a `quality-` prefix so they sort and read
as a single category:

- `chaos-monkey` -> `quality-chaos-monkey`
- `cli-agent-friendly-audit` -> `quality-cli-agent-friendly-audit`
- `code-cleanup-analyzer` -> `quality-dead-code-analyzer`
- `perf-review` -> `quality-perf-review`

Breaking for installers: update `npx skills add -s <old-name>` invocations to
the new `quality-*` names. `quality-dead-code-analyzer` also gets a clearer
name for its main job: repo-wide dead code, duplicate code, and circular
dependency analysis.
