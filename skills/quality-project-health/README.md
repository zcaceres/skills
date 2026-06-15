# quality-project-health

Slash command for assessing the current repo and work tracker, then rating
overall project health from 0-10.

**Usage:** `/quality-project-health [focus]`

The skill inspects git state, obvious validation commands, project metadata,
and the GitHub Project board helper when present.

## Install

```sh
npx skills add zcaceres/skills -s quality-project-health
```

Add `-g` for global install, or `-a <agent>` to target a specific agent.

## Origin

Renamed from the Claude Code command:

```text
What's the status of this project? Rate it on a quality level of 0-10.
```
