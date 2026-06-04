---
name: trip-planner
description: Generate personalized packing lists from a weather forecast. Use when user says 'plan a trip', 'packing list', 'what should I pack', or 'trip to [destination]'.
---

# Trip Planner

Generate a customized packing list and pre-trip checklist based on destination weather and trip duration.

The output is a single markdown file with Obsidian-style checkboxes so the user can tick items as they pack.

## Layout

- `SKILL.md` — this file
- `scripts/weather_helper.py` — fetches forecast from [wttr.in](https://wttr.in) (free, no API key, no auth)
- `assets/packing_template.md` — packing list template with conditional sections

## When to Use

Trigger phrases:
- "plan a trip", "packing list", "trip to [destination]"
- "what should I pack for [destination]"
- "create a packing list"

## Workflow

### Step 1: Gather Trip Details

Use AskUserQuestion to collect:

**Required:**
- Destination (city/country)
- Departure date
- Return date

**Optional (ask only if unclear from context):**
- Trip type: business or leisure?
- Flying or driving?
- International travel?
- Pool/gym at accommodation?

### Step 2: Fetch the Forecast

Run the bundled weather helper:

```bash
python3 scripts/weather_helper.py "DESTINATION" --json
```

The script writes JSON to stdout. Parse and extract:
- `temperature.category` — freezing / cold / cool / mild / warm / hot
- `precipitation.rain_chance_max`, `precipitation.snow_chance_max`
- `packing_recommendations.*` — booleans for coat, umbrella, sunscreen, etc.

Show the user a one-paragraph summary before continuing:

```
Weather for New York City
Cold (32°F – 45°F). Rain likely (60%).
Recommended: winter coat, warm layers, umbrella, waterproof shoes.
```

For a human-readable version (skipping JSON parsing), drop `--json`.

### Step 3: Calculate Trip Duration

From the dates, compute:
- `nights` = (return − departure) in days
- `underwear_count` = nights + 1
- `socks_count` = nights + 1
- `t_shirt_count` = min(nights, 5)
- `pants_count` = ceil(nights / 3) + 1

### Step 4: Fill the Template

Read `assets/packing_template.md` and substitute:

| Placeholder            | Source                                     |
|------------------------|--------------------------------------------|
| `{{NIGHTS}}`           | computed                                   |
| `{{DESTINATION}}`      | user input                                 |
| `{{START_DATE}}`       | user input                                 |
| `{{END_DATE}}`         | user input                                 |
| `{{WEATHER_SUMMARY}}`  | `summary` field from helper                |
| `{{UNDERWEAR_COUNT}}`  | computed                                   |
| `{{SOCKS_COUNT}}`      | computed                                   |
| `{{DESTINATION_TIPS}}` | optional — see Step 5                      |

Include or strip the conditional `{{#if X}}…{{/if}}` blocks based on:

| Condition                                    | Include                |
|----------------------------------------------|------------------------|
| `temp_category in {freezing, cold}`          | `COLD_WEATHER`         |
| `temp_category == cool`                      | `COOL_WEATHER`         |
| `temp_category in {warm, hot}`               | `WARM_WEATHER`         |
| `rain_chance_max > 30`                       | `RAIN_LIKELY`          |
| `trip_type == business`                      | `BUSINESS_TRIP`        |
| `flying == true`                             | `FLYING`               |
| `international == true`                      | `INTERNATIONAL`        |
| `has_pool == true`                           | `HAS_POOL`             |
| `has_gym == true`                            | `HAS_GYM`              |
| `nights > 2`                                 | `NIGHTS_GT_2`          |
| `nights > 3`                                 | `NIGHTS_GT_3`          |
| `nights > 5`                                 | `NIGHTS_GT_5`          |

These are simple text markers — process them with whatever rendering you prefer (sed, Python, in-context substitution).

### Step 5: Optional Destination Tips

If the destination is well-known, drop a short tip block into `{{DESTINATION_TIPS}}`. Otherwise leave it empty. A few examples:

**Generic international:**
- Check passport expiry (must be valid 6+ months for most countries)
- Notify your bank of travel dates
- Download offline maps and translation
- Screenshot important confirmations

**Dense urban / walking-heavy:**
- Pack comfortable shoes — you may walk 10+ miles/day
- Layers help with warm interiors and cold streets

Don't fabricate tips for destinations you can't reason about confidently.

### Step 6: Write the Output

Write the filled template to the current working directory:

```
./Trip - <DESTINATION> (<START_DATE>).md
```

Example: `./Trip - NYC (2026-06-15).md`

Note: calendar integration (checking pre-trip schedule conflicts) is intentionally out of scope for this skill. If the user wants it, suggest they paste calendar items into the "Pre-Trip Tasks" section by hand for now.

### Step 7: Summarize

After writing, tell the user:

```
Trip Planning Complete
Destination: New York City
Dates: Jun 15-20, 2026 (5 nights)
Weather: Cold (32-45°F), rain likely

Created: ./Trip - NYC (2026-06-15).md

Key items flagged:
- Winter coat & warm layers
- Umbrella & waterproof shoes
- Business attire (3 button shirts)
```

## Reference

### Weather helper commands

```bash
# Human-readable
python3 scripts/weather_helper.py "Paris"

# JSON (for parsing)
python3 scripts/weather_helper.py "Tokyo" --json

# Date range (forecast is only accurate ~3 days out)
python3 scripts/weather_helper.py "London" --start 2026-01-15 --end 2026-01-20
```

### Temperature categories

| Category | Min temp (°F) | Packing focus            |
|----------|---------------|--------------------------|
| Freezing | ≤ 32          | Heavy coat, boots, layers|
| Cold     | 33–45         | Winter coat, sweaters    |
| Cool     | 46–60         | Light jacket, layers     |
| Mild     | 61–75         | Light layers, versatile  |
| Warm     | 76–85         | Light clothing, sun gear |
| Hot      | > 85          | Minimal clothing, SPF    |

### Quantity formulas

| Item          | Formula            | Example (5 nights) |
|---------------|--------------------|--------------------|
| Underwear     | nights + 1         | 6                  |
| Socks         | nights + 1         | 6                  |
| T-shirts      | min(nights, 5)     | 5                  |
| Pants         | ceil(nights/3) + 1 | 3                  |
| Button shirts | 3 (business only)  | 3                  |

## Notes

- wttr.in forecasts are most accurate 3–5 days out. For trips further out, treat the forecast as general guidance and tell the user.
- The template is meant to be edited — encourage users to fork `assets/packing_template.md` for personal items (medications, specific gear).
- The skill never deletes or overwrites previous trip files; if the same destination + start date is generated twice, append a numeric suffix.
