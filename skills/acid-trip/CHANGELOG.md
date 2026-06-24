# @zcaceres/skill-acid-trip

## 1.1.0

### Minor Changes

- b558887: Phase 2 now ends by extracting a standardized design system from the
  built artifact: `acid-trip-<id>-design-system.md` with a fixed skeleton
  (aesthetic summary, Palette, Typography, Spacing & Grid, Motion,
  Components & Motifs) plus a machine-readable `acid-trip-<id>-tokens.json`.
  In `--paper` mode the system is also laid out as a spec-sheet artboard.
  Previously the model improvised design-system docs, letting the rolled
  lineage/subject randomness leak into the document's structure (themed
  sections, in-character prose). The new ritual rule pins it down: the trip
  drives the values, never the shape.
- 9bdd466: Forbid two more AI-design clichés in the self-critique pass: eyebrow/kicker
  labels above headlines and images ("FEATURED," "SECTION 01," "PRESENTING,"
  per-image category tags) and over-stuffed element headers/footers (top
  strips of category·tag·timestamp, bottom strips of "read more →" + author +
  date + share rows). Both are added to the Forbidden micro-anatomy list, with
  matching audit-note examples and rebuild moves so the mandatory critique pass
  actually catches and restructures them — fuse the kicker into the headline or
  drop it, and strip each element's chrome down to what the real document_type
  physically carries (often nothing).
- 2d5501b: Forbid gratuitous italic emphasis in the self-critique pass — single words and
  stray phrases set in italic for "emphasis" or borrowed elegance (an italic
  adjective per paragraph, an italic tagline under the headline, italic
  pull-quotes and captions by default). This is distinct from the already-banned
  italic explainer paragraph: it's the AI tic of sprinkling italic stress through
  running text to fake "voice," where a real typesetter reserves italic for
  titles of works, foreign terms, true contrastive stress, and citation. Added to
  the Forbidden micro-anatomy list with a matching audit-note example and rebuild
  move so the mandatory critique pass catches it and restructures — un-italicize,
  and reach for the lineage's own emphasis device (weight, caps, size, color,
  letterspacing) when emphasis is genuinely needed.
- b558887: `roll.py` now rolls a third structural axis: `type_pairing`, a display +
  body font pair sampled from a curated pool whose tags overlap the rolled
  lineage's `type_tags`. Typography was previously derived freely by the
  LLM, which collapsed to the same few "safe" faces (Caslon, Cooper Black,
  Druk) across trips. The rolled pair is the floor; the article modulates
  weight/casing/tracking rather than overriding the faces. Rerolling
  lineage automatically rerolls the pairing so it stays tag-matched.

## 1.0.0

### Major Changes

- Initial release: Claude Code slash command for design rituals driven by
  real-world entropy. A Python roller (`scripts/roll.py`) picks two
  structural axes (`document_type` + `lineage`) from curated lists via
  `/dev/urandom`; Wikipedia's `Special:Random` endpoint supplies a subject.
  Palette, typography, layout, and mood are _derived_ from the article ×
  lineage collision — never rolled separately. The skill runs as a two-
  phase ritual: **Trip → pause → Realize**, with a mandatory self-critique
  pass that audits against a hard blacklist and a forbidden-micro-anatomy
  list before stamping provenance.

  Ported from
  [`zcaceres/claude-acid-trip`](https://github.com/zcaceres/claude-acid-trip).
  Two mechanical path updates: `~/.claude/skills/acid-trip/roll.py` →
  `${CLAUDE_SKILL_DIR}/scripts/roll.py` (so the script resolves correctly
  under both personal and project installs). Body, blacklist, ritual rules,
  and provenance-stamp format are preserved verbatim.
