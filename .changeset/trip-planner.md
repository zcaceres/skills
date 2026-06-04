---
"@zcaceres/skill-trip-planner": major
---

Add trip-planner — generates a customized packing list and pre-trip
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
