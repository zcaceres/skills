# clean-ai-slop

Diffs the current branch against `main` and strips AI-generated slop —
superfluous comments, defensive `try/catch`, casts to `any`, and other style
that doesn't match the surrounding file. Activates when the user says "clean
ai slop", "remove ai slop", "strip ai code", or invokes `/clean-ai-slop`.

See [SKILL.md](./SKILL.md) for the full workflow.

Pure-prompt skill — no scripts, no binaries.

## Install

```sh
npx skills add zcaceres/skills -s clean-ai-slop
```

## Origin

Ported from the `clean-ai-slop` slash command in `~/.claude/commands/` into
this monorepo. Workflow and reporting format preserved.
