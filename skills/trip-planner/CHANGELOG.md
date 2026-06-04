# @zcaceres/skill-trip-planner

## 1.0.0

### Major Changes

- Initial release: Claude Code skill that generates a customized
  packing list and pre-trip checklist from a destination weather
  forecast. Bundles `scripts/weather_helper.py` (fetches forecasts from
  wttr.in — free, no API key) and `assets/packing_template.md` (with
  conditional sections for cold/cool/warm weather, rain, business
  travel, flying, international, pool/gym). Writes a single markdown
  file to the current working directory.

  Ported from the user's local `~/.claude/skills/trip-planner/`.
  Personal Obsidian output path, brand-specific gear references, and a
  dependency on a private `daily-planning` skill for calendar
  integration were removed. Calendar integration is intentionally out
  of scope for v1.
