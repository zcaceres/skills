# @zcaceres/skill-reflect-on-conversation

## 1.0.0

### Major Changes

- Initial release: Claude Code skill for producing a structured
  retrospective on the current conversation. Analyzes user prompting,
  agent performance, system gaps, efficiency, and alternative technical
  approaches. Output is organized into three priority "Top 3" lists (new
  skills/tools to build, prompting changes to try, other improvements)
  followed by detailed sections on course correction, documentation gaps,
  workflow, technical retrospective, and a next-time checklist.

  Ported from the user's local `~/.claude/skills/reflect-on-conversation/`
  into this monorepo. SKILL.md body preserved verbatim; the upstream's
  `examples.md` was moved into `references/examples.md`.
