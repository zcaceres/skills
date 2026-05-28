# @zcaceres/skill-decompose

## 1.0.0

### Major Changes

- Initial release: Claude Code slash command for breaking a stuck problem into
  smaller, tractable pieces. Diagnoses what kind of stuck the user is in
  (opacity, paralysis, bug fog, scope, concept fuzz, design uncertainty) and
  applies 1–3 lenses (Known/Assumed/Unknown ledger, sub-problem tree,
  smallest-next-experiment, first-principles restatement, trace, analogy,
  binding constraint) to give the user a foothold. Triggered via
  `/decompose [focus]`. Pure-markdown skill — no binaries.

  Ported from
  [`zcaceres/claude-decompose`](https://github.com/zcaceres/claude-decompose)
  with the body preserved verbatim.
