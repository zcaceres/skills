---
"@zcaceres/skill-decompose": minor
---

Add an optional **Map** step to the `decompose` output — a compact ASCII
diagram of the pieces as nodes and their dependencies as arrows, sitting
between the numbered pieces and the "how they connect" bullets. Nodes
cross-reference the list by number; arrows can be labelled with what flows
across them. The diagram is skipped (or collapsed to a one-line chain) when
the structure is a trivial straight line, keeping with the skill's
false-structure-is-worse-than-none stance.
