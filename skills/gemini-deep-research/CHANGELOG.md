# @zcaceres/skill-gemini-deep-research

## 1.0.0

### Major Changes

- Initial release: runs Google's Deep Research agent
  (`deep-research-pro-preview-12-2025`) against
  `generativelanguage.googleapis.com` to produce comprehensive markdown
  reports. Activates when the user asks for a "deep research report",
  "gemini research", or similar. Submits the query, returns an interaction
  ID, starts a detached background poller that checks status every 60s
  (15-min timeout), caches the result on disk, and exposes `check` and
  `result` commands so the agent can retrieve the finished report. Reports
  typically take 2–5 minutes.

  Ported from `~/.claude/skills/gemini-deep-research` with the helper script
  preserved verbatim. SKILL.md scrubbed of personal paths — output
  directory now configurable via `GEMINI_RESEARCH_OUT` env var (defaults to
  `./research/` in CWD). API key reads from `GEMINI_API_KEY` env var
  (preferred) or a gitignored `scripts/config.txt`. Past report cache
  files (`scripts/.cache/`) are gitignored.
