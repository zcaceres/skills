# reflect-on-conversation

Claude Code skill for producing a structured retrospective on the
current conversation. Analyzes user prompting, agent performance, system
gaps, efficiency, and alternative technical approaches. Output is
organized into three priority "Top 3" lists (new skills/tools to build,
prompting changes to try, other improvements) followed by detailed
sections on course correction, documentation gaps, workflow, technical
retrospective, and a next-time checklist.

See [SKILL.md](./SKILL.md) for the dimensions and output template, and
[`references/examples.md`](./references/examples.md) for example output
drawn from real sessions.

## Install

```sh
npx skills add zcaceres/skills -s reflect-on-conversation
```

Pure-markdown skill — no binaries, no install-time side effects.

## Origin

Ported from the user's local `~/.claude/skills/reflect-on-conversation/`
into this monorepo. SKILL.md body preserved verbatim;
`examples.md` moved into `references/`.
