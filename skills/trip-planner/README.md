# trip-planner

Claude Code skill that generates a customized packing list from a
destination weather forecast. Asks for destination + dates + trip
shape (business/leisure, flying, international, pool/gym), fetches a
forecast from [wttr.in](https://wttr.in) via the bundled `bun`
helper, computes clothing quantities from trip length, fills a
template with conditional sections, and writes a single markdown
file with checkboxes to the current working directory.

See [SKILL.md](./SKILL.md) for the full workflow, condition table,
quantity formulas, and the example summary it emits.

## Install

```sh
npx skills add zcaceres/skills -s trip-planner
```

Add `-g` for global install, or `-a <agent>` to target a specific agent.

## Requirements

- `bun` on `$PATH` (used to run `scripts/weather-helper.ts`)
- Network access to `wttr.in` (no API key required)

## Origin

Ported from the user's local `~/.claude/skills/trip-planner/`.
Personal Obsidian output path, brand-specific gear references, and a
dependency on a private `daily-planning` skill for calendar
integration were removed. Calendar integration is intentionally out
of scope for v1.
