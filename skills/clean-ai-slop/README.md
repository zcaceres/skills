# clean-ai-slop

Find AI-generated noise in the current branch's diff — tombstone comments,
restating-the-code comments, callsite references, unused imports, dead internal
symbols — propose each finding for confirmation, apply only what's approved,
and verify with the project's typecheck and tests. Activates when the user
says "clean ai slop", "remove ai slop", "strip ai code", or invokes
`/clean-ai-slop`.

Scope is intentionally tight: this skill does **not** touch `try/catch`,
`any` casts, or redundant extractions — those belong to `/simplify` or
`/code-review`.

See [SKILL.md](./SKILL.md) for the full workflow.

Pure-prompt skill — no scripts, no binaries.

## Install

```sh
npx skills add zcaceres/skills -s clean-ai-slop
```

## Origin

Ported from the `clean-ai-slop` slash command in `~/.claude/commands/` into
this monorepo. Workflow and reporting format preserved.
