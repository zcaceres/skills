---
"@zcaceres/skill-safety-rm-rf-guard": minor
---

Block via the PreToolUse `permissionDecision: "deny"` JSON contract on stdout
(exit 0) instead of exit code 2. Claude Code and Codex CLI both honor this
shape, whereas Codex treats a non-zero exit as a hook *failure* and would let
the destructive command through — so the old exit-2 path was a silent no-op on
Codex. Adds a "Codex CLI" install section (manual `~/.codex/config.toml`
wiring with `[[PreToolUse]]`, the `/hooks` trust step, and the `unified_exec`
best-effort caveat). Allowed commands are unchanged (empty stdout, exit 0).
