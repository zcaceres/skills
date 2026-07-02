---
"@zcaceres/skill-pr": minor
---

Add Gemini CLI support to the `pr` skill so one skill dir serves both hosts. The nudge binary now reads the host's hook event name from the payload (`PostToolUse` for Claude Code, `AfterTool` for Gemini CLI), echoes it back in the output envelope, and homes its state file under the matching config dir (`~/.claude` or `~/.gemini`, overridable with `PR_NUDGE_STATE_DIR`). `install.sh` gains an `--agent claude|gemini` flag (auto-detected when omitted) that wires the correct event name, tool matcher, and settings dir. `/pr setup` now runs `install.sh` for you — inferring `--agent` from the host it's executing in — so configuring the skill both wires the hook and provisions the binary in one step, instead of leaving the wiring as a manual shell command. This folds in and replaces the standalone `stacked-pr-gemini` skill, which is removed.
