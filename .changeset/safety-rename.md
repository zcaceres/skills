---
"@zcaceres/skill-safety-rm-rf-guard": major
"@zcaceres/skill-safety-git-reset-guard": major
"@zcaceres/skill-safety-dotenv-guard": major
"@zcaceres/skill-safety-op-creds": major
---

Rename the four block-hook skills under a `safety-` prefix so they sort and
read as a single category:

- `rm-rf-guard` → `safety-rm-rf-guard`
- `git-reset-guard` → `safety-git-reset-guard`
- `dont-read-dot-env` → `safety-dotenv-guard`
- `op-creds` → `safety-op-creds`

Breaking changes for installers and anyone with hook wiring referencing the
old paths: update `npx skills add -s <name>` invocations to the new name, and
update `~/.claude/settings.json` hook command paths from
`~/.claude/skills/<old>/scripts/run.sh` to `~/.claude/skills/<new>/scripts/run.sh`.
The published binaries are also renamed (`<new>-darwin-arm64`, etc.).
