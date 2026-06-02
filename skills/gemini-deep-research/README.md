# gemini-deep-research

Runs Google's Deep Research agent to produce comprehensive markdown reports
on any topic. Reports typically take 2–5 minutes; polling runs in the
background.

See [SKILL.md](./SKILL.md) for the full workflow, configuration, and example
session.

## Install

```sh
npx skills add zcaceres/skills -s gemini-deep-research
```

Or grab the tarball from the latest
[GitHub release](https://github.com/zcaceres/skills/releases?q=gemini-deep-research).

## Configuration

**API key (required):**

```bash
export GEMINI_API_KEY="your-key-here"
```

Or copy `scripts/config.txt.example` to `scripts/config.txt` and add the key
there (gitignored). The env var is preferred — `config.txt` puts a plaintext
secret on disk.

Get a key from <https://aistudio.google.com/apikey>.

**Output directory (optional):**

```bash
export GEMINI_RESEARCH_OUT="$HOME/Documents/research"
```

Defaults to `./research/` in the current working directory.

## Caveats

- The skill targets the preview agent `deep-research-pro-preview-12-2025`.
  When Google promotes it out of preview (or retires it), update `AGENT` in
  `scripts/gemini-helper.ts`.
- Background polling uses a detached `bun` process. If the loop crashes
  mid-flight, the next `check` / `result` call queries the API directly, so
  state is recoverable — but the cache file isn't written until the loop
  completes or times out (15 min).

## Origin

Ported from `~/.claude/skills/gemini-deep-research` into this monorepo.
Helper script preserved verbatim; SKILL.md scrubbed of personal paths and
parameterized via `GEMINI_RESEARCH_OUT`.
