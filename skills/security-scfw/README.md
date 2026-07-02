# security-scfw

Set up [Supply-Chain Firewall](https://github.com/DataDog/supply-chain-firewall)
(`scfw`) — Datadog's open-source, client-side gate that **blocks known-malicious
npm / PyPI / Poetry packages before they install**, checking every target
against Datadog's malicious-packages dataset + OSV.dev.

It's the closest open-source analog to a registry-side "malicious package
firewall." Where [security-snyk](../security-snyk) and
[security-socket](../security-socket) scan PRs in CI, and
[security-bumblebee](../security-bumblebee) inventories what's already on the
endpoint, `scfw` sits at **install time** on the developer machine and stops
bad packages from ever landing.

It's a **reactive, known-bad gate** (not behavioral) — run it alongside the
CI-side skills for defense in depth, not instead of them.

Two modes:

**Setup mode** (once):

1. Installs `scfw` via `pipx`.
2. Runs `scfw configure` to add shell aliases so `pip` / `npm` / `poetry`
   passively route through the firewall — this is what makes it part of the
   toolchain; you don't re-invoke the skill.
3. Smoke-tests the pipeline with `scfw run --dry-run` (no real install, no
   malware).
4. Optionally installs a Claude Code PreToolUse hook so the agent's *own*
   installs are vetted too — denying un-wrapped npm/pip/poetry installs and
   flagging bun/pnpm installs (which scfw can't cover) for awareness.

**Review mode** (every time after):

- Confirms the firewall is still wired.
- Reads the local JSON Lines log (`~/.scfw/scfw.log`) for recent blocks/warnings.
- Runs `scfw audit` to re-check already-installed packages against the feeds.
- Answers advisory lookups ("did scfw block/see package X?").

## Use

User-triggered only. Invocations:

- `/security-scfw` — picks mode automatically (review if configured, setup otherwise).
- `/security-scfw setup` — force the install/configure flow.
- `/security-scfw review` — confirm wiring + walk recent blocks/warnings.
- `/security-scfw audit` — re-check already-installed packages.

## Layout

- `SKILL.md` — manifest + instructions
- `scripts/scfw-guard.sh` — optional PreToolUse hook that vets the agent's own installs
- `scripts/install.sh` — wires (or removes) that hook in `settings.json`

## Install

```sh
npx skills add zcaceres/skills -s security-scfw
```

Add `-g` for global install, or `-a <agent>` to target a specific agent.

The optional agent hook is opt-in — the setup flow prompts you, then wires it
with:

```sh
~/.claude/skills/security-scfw/scripts/install.sh          # user scope
~/.claude/skills/security-scfw/scripts/install.sh --remove # undo
```
