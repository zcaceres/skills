---
name: gemini-deep-research
description: Run Google Gemini Deep Research reports on any topic. Use when user says "deep research", "research report", "gemini research", or "run a research report on...". Generates comprehensive research reports using Google's Deep Research agent.
---

# Gemini Deep Research

This skill runs Google's Deep Research agent to produce comprehensive research
reports on any topic. Reports typically take 2–5 minutes to generate.

## Configuration

**API key** — the script checks for the key in this order:

1. `GEMINI_API_KEY` environment variable (recommended)
2. `config.txt` next to the helper script (see `config.txt.example`)

Get a key from <https://aistudio.google.com/apikey>.

**Helper script** — `scripts/gemini-helper.ts` inside this skill directory.
Resolve the absolute path with the `${CLAUDE_SKILL_DIR}` substitution Claude
Code provides at install time, or use the install path under
`~/.claude/skills/gemini-deep-research/scripts/gemini-helper.ts` (personal
install) / `./node_modules/@zcaceres/skill-gemini-deep-research/scripts/gemini-helper.ts`
(project install).

**Output directory** — checked in this order:

1. `GEMINI_RESEARCH_OUT` environment variable
2. `./research/` in the current working directory (created if missing)

## Workflow

### Step 1: Get research topic

Use AskUserQuestion to ask what the user wants to research:

- Question: "What topic would you like me to research?"
- Let the user provide a detailed topic or question.

### Step 2: Submit research request

Run the helper script to submit the research:

```bash
bun "${CLAUDE_SKILL_DIR}/scripts/gemini-helper.ts" submit "<topic>"
```

The script returns JSON with the interaction ID:

```json
{"id": "abc123", "status": "in_progress"}
```

### Step 3: Start background polling

Start the background poller which checks every 60 seconds and caches the
result when done:

```bash
bun "${CLAUDE_SKILL_DIR}/scripts/gemini-helper.ts" poll <interaction-id>
```

This returns immediately and polls in the background.

**Tell the user:** "Research started — this typically takes 2–5 minutes. I'll
let you know when it's ready; feel free to keep working on other things."

### Step 4: Check for completion

Periodically check if the research is complete:

```bash
bun "${CLAUDE_SKILL_DIR}/scripts/gemini-helper.ts" check <interaction-id>
```

Returns:

```json
{"id": "abc123", "status": "in_progress", "cached": false}
```

or when complete:

```json
{"id": "abc123", "status": "completed", "cached": true}
```

When `cached: true`, the result is ready.

### Step 5: Get the report

Once status is `completed`, get the full report:

```bash
bun "${CLAUDE_SKILL_DIR}/scripts/gemini-helper.ts" result <interaction-id>
```

This outputs the full markdown report with citations (from cache when
available).

### Step 6: Save the report

Generate a filename using the topic:

- Format: `Deep-Research-YYYY-MM-DD-HHmm-<slug>.md`
- Slug: lowercase topic with spaces replaced by hyphens, max 50 chars
- Example: `Deep-Research-2026-06-02-1430-climate-change-effects.md`

Save into the configured output directory:

```bash
OUT_DIR="${GEMINI_RESEARCH_OUT:-./research}"
mkdir -p "$OUT_DIR"
# write the report file into "$OUT_DIR/<filename>"
```

### Step 7: Notify the user

After saving:

1. Tell the user: "Your research report is ready."
2. Show the report's path.
3. Display a brief summary (first 3–5 key points).
4. Offer to show the full report.

## Error handling

- **API key missing** — point the user at `GEMINI_API_KEY` env var (preferred)
  or `scripts/config.txt` (copy from `config.txt.example`).
- **Research fails** — surface the error message from the API.
- **Timeout (>15 min)** — suggest a more focused query.

## Example session

```
User: Run a deep research report

Claude: What topic would you like me to research?

User: The current state of fusion energy research and commercial viability

Claude: Starting deep research on fusion energy...
Research submitted — this typically takes 2–5 minutes. I've started
background polling and will let you know when it's ready. You can keep
working on other things.

[Later, after checking status...]

Claude: Your research report is ready.

Saved to: ./research/Deep-Research-2026-06-02-1430-fusion-energy-research.md

Key findings:
1. ITER construction 70% complete, first plasma expected 2035
2. Private sector investment reached $6B in 2024
3. Commonwealth Fusion Systems targeting 2030s commercialization
4. ...

Would you like me to show the full report?
```

## Notes

- The skill calls `https://generativelanguage.googleapis.com/v1beta` with the
  preview agent `deep-research-pro-preview-12-2025`. If Google renames or
  retires the preview, update `AGENT` in `scripts/gemini-helper.ts`.
- Background polling runs as a detached `bun` process; if the host shell exits
  before the poll loop finishes, the loop still completes and writes the
  cached result. If the loop itself crashes, the next `check`/`result` call
  hits the API directly.
