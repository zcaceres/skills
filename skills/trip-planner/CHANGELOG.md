# @zcaceres/skill-trip-planner

## 1.0.0

### Major Changes

- 0f194ca: Add trip-planner — generates a customized packing list and pre-trip
  checklist from a destination weather forecast. Asks for destination,
  dates, and trip shape (business/leisure, flying, international,
  pool/gym), fetches the forecast via a bundled wttr.in Python helper
  (free, no API key), computes clothing quantities from trip length,
  fills a template with conditional cold/cool/warm/rain/business/flying
  sections, and writes a single checkbox-style markdown file to the
  current working directory.

  Ported from the user's local `~/.claude/skills/trip-planner/`.
  Personal Obsidian output path, brand-specific gear references, and a
  dependency on a private `daily-planning` skill for calendar
  integration were removed; calendar integration is intentionally out
  of scope for v1.

## 1.0.0

### Major Changes

- Initial release: Claude Code skill that generates a customized
  packing list and pre-trip checklist from a destination weather
  forecast. Bundles `scripts/weather-helper.ts` (fetches forecasts from
  wttr.in — free, no API key; runs under `bun`) and
  `assets/packing_template.md` (with conditional sections for
  cold/cool/warm weather, rain, business travel, flying, international,
  pool/gym). Writes a single markdown file to the current working
  directory.

  Ported from the user's local `~/.claude/skills/trip-planner/`.
  Personal Obsidian output path, brand-specific gear references, and a
  dependency on a private `daily-planning` skill for calendar
  integration were removed. Calendar integration is intentionally out
  of scope for v1.
