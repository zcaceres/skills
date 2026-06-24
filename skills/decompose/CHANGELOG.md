# @zcaceres/skill-decompose

## 2.0.0

### Major Changes

- 313c235: Rewrite `decompose` around a single job: break the input (current
  conversation by default, or a passed focus) into 3–7 named pieces and show
  how they connect. Removes the stuck-diagnosis taxonomy, the lens library,
  and the numbered drill-down syntax — follow-ups are now plain conversation.

### Minor Changes

- ef155e1: Add an optional **Map** step to the `decompose` output — a compact ASCII
  diagram of the pieces as nodes and their dependencies as arrows, sitting
  between the numbered pieces and the "how they connect" bullets. Nodes
  cross-reference the list by number; arrows can be labelled with what flows
  across them. The diagram is skipped (or collapsed to a one-line chain) when
  the structure is a trivial straight line, keeping with the skill's
  false-structure-is-worse-than-none stance.

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
