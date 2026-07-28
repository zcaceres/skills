---
"@zcaceres/skill-ste100": minor
---

New skill: `ste100`. Writes everything the agent presents in ASD-STE100
Simplified Technical English — one word for one thing, active voice, simple
tenses, 20 words in an instruction and 25 in a description, one instruction per
sentence, warnings before the step they guard.

Same shape as `laconic`: a `/ste100` control surface over a one-line state file
(project overrides user), a `SessionStart` hook that injects the rules, a
cadence-gated `UserPromptSubmit` hook that restates them each turn, a status-line
badge, and idempotent `install.sh` / `uninstall.sh`. No modes — on or off.

The rules govern replies and the prose around code (commit messages, PR bodies,
comments, docs). They never govern the code: identifiers, logic, values, command
syntax, and error text stay exact. Section 7 (safety instructions) outranks
brevity, so risks are stated in full.

ASD's controlled dictionary is not bundled. `assets/word-swaps.md` carries a
small illustrative swap table and points at <https://www.asd-ste100.org/> for the
real specification.
