# acid-trip

Claude Code slash command for design rituals driven by real-world entropy.
A Python roller picks two structural axes (`document_type` + `lineage`)
from curated lists via `/dev/urandom`; Wikipedia's `Special:Random`
supplies a subject. Palette, typography, layout, and mood are *derived*
from the article × lineage collision — never rolled separately.

```
/acid-trip             # default HTML output
/acid-trip --react     # JSX output (Tailwind + motion assumed)
/acid-trip --paper     # build directly into the active Paper canvas
```

The skill runs as **Trip → pause → Realize**. Phase 1 rolls + presents
a brief; the user approves, rerolls, or overrides. Phase 2 builds the
design with a mandatory self-critique pass that audits against the
hard-blacklist and forbidden-micro-anatomy lists.

See [SKILL.md](./SKILL.md) for the full ritual, the blacklist, and the
provenance-stamp format. The roller lives at
[`scripts/roll.py`](./scripts/roll.py).

## Prerequisites

- **Python 3** for `roll.py` (uses only stdlib: `argparse`, `json`,
  `secrets`, `random`, `pathlib`).
- **`WebFetch` tool** for fetching the Wikipedia subject — Claude Code
  provides this.
- **Image generation** (optional) via a separate `nano-banana-generator`
  skill. If absent or `GEMINI_API_KEY` is unset, fall back to a pure
  typography-and-CSS design (noted in the provenance stamp).

## Develop

```sh
bun install                                  # link workspace
python3 scripts/roll.py                      # smoke-test the roller
python3 scripts/roll.py --seed 0123456789abcdef   # reproduce a prior trip
```

## Install

```sh
npx skills add zcaceres/skills -s acid-trip
```
## Origin

Ported from
[`zcaceres/claude-acid-trip`](https://github.com/zcaceres/claude-acid-trip)
into this monorepo. SKILL.md body preserved verbatim except for two
mechanical path updates:
`~/.claude/skills/acid-trip/roll.py` →
`${CLAUDE_SKILL_DIR}/scripts/roll.py` (so the script resolves correctly
under both personal and project installs).
