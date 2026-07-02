#!/usr/bin/env bash
# security-scfw PreToolUse (Bash) guard.
#
# `scfw configure` installs shell aliases that route pip/npm/poetry through the
# Supply-Chain Firewall — but aliases only apply to *interactive* shells, so
# Claude Code's own non-interactive install commands slip past the firewall.
# This hook closes that gap, with two behaviors:
#
#   * pip / npm / poetry (scfw-supported)  -> DENY unless already run through
#     `scfw run`, telling the agent to re-issue it as `scfw run <command>` so
#     scfw can vet the targets. Detection is delegated entirely to scfw.
#   * bun / pnpm (NOT scfw-supported)      -> ASK. scfw can't run these, but
#     their packages come from the npm registry and enter *outside* the
#     firewall. We surface that for a human decision rather than pretend
#     they're vetted (and rather than hard-block, which scfw can't remediate).
#
# Emits the Claude Code PreToolUse decision as JSON on stdout. Fail-open by
# design: anything it can't classify (or if jq is missing / not a Bash call) is
# allowed silently, so it never breaks unrelated Bash tool calls.
#
# Wire it into settings.json with scripts/install.sh (PreToolUse matcher: Bash).

set -uo pipefail

# Fail open if we can't parse the hook payload.
command -v jq >/dev/null 2>&1 || exit 0

payload="$(cat)"

tool="$(printf '%s' "$payload" | jq -r '.tool_name // empty' 2>/dev/null)"
[ "$tool" = "Bash" ] || exit 0

cmd="$(printf '%s' "$payload" | jq -r '.tool_input.command // empty' 2>/dev/null)"
[ -n "$cmd" ] || exit 0

# Already routed through the firewall anywhere in the command → allow.
if printf '%s' "$cmd" | grep -Eq '(^|[[:space:];&|(])scfw[[:space:]]+run([[:space:]]|$)'; then
  exit 0
fi

# Emit a PreToolUse permission decision (allow|deny|ask) with a reason, then exit.
emit() {
  jq -n --arg d "$1" --arg r "$2" \
    '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: $d, permissionDecisionReason: $r}}'
  exit 0
}

# --- Managers scfw supports: enforce `scfw run` --------------------------------
# Anchored on command boundaries so "pipx" / "npm-run-all" don't false-match.
pip_re='(^|[;&|(]|[[:space:]])(pip[0-9.]*|python[0-9.]*[[:space:]]+-m[[:space:]]+pip)[[:space:]]+install([[:space:]]|$)'
npm_re='(^|[;&|(]|[[:space:]])npm[[:space:]]+(install|i|in|ins|inst|insta|instal|isnt|isnta|isntal|isntall|add)([[:space:]]|$)'
poetry_re='(^|[;&|(]|[[:space:]])poetry[[:space:]]+(add|install|sync|update)([[:space:]]|$)'

if printf '%s' "$cmd" | grep -Eq "$pip_re|$npm_re|$poetry_re"; then
  emit deny "[security-scfw] This install would bypass the Supply-Chain Firewall (scfw's shell aliases don't apply to this non-interactive shell). Re-run it through scfw so the targets are checked against Datadog's malicious-packages dataset + OSV before anything installs:

  scfw run <your original command>

scfw auto-blocks known-malicious packages and prompts on warnings. If you must install something scfw can't vet (an unsupported manager/version), append --allow-unsupported to the scfw run command."
fi

# --- Managers scfw can't run: flag for awareness -------------------------------
pnpm_re='(^|[;&|(]|[[:space:]])pnpm[[:space:]]+(add|install|i|import|update|up|dlx)([[:space:]]|$)'
bun_re='(^|[;&|(]|[[:space:]])(bunx|bun[[:space:]]+(add|install|i|x))([[:space:]]|$)'

if printf '%s' "$cmd" | grep -Eq "$pnpm_re|$bun_re"; then
  emit ask "[security-scfw] This is a bun/pnpm install, which the Supply-Chain Firewall does NOT cover (scfw supports npm, pip, and Poetry only). These packages come from the npm registry but would enter *outside* the firewall — nothing is being vetted against the malicious-package feeds. Approve only if you trust them; for firewall coverage, install the same packages with npm (scfw run npm install ...) instead."
fi

exit 0
