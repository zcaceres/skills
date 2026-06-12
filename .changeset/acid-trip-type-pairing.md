---
"@zcaceres/skill-acid-trip": minor
---

`roll.py` now rolls a third structural axis: `type_pairing`, a display +
body font pair sampled from a curated pool whose tags overlap the rolled
lineage's `type_tags`. Typography was previously derived freely by the
LLM, which collapsed to the same few "safe" faces (Caslon, Cooper Black,
Druk) across trips. The rolled pair is the floor; the article modulates
weight/casing/tracking rather than overriding the faces. Rerolling
lineage automatically rerolls the pairing so it stays tag-matched.
