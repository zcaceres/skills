---
name: scfw
description: Set up and use Datadog's Supply-Chain Firewall (scfw) to block known-malicious npm/PyPI/Poetry packages at install time. Two modes — setup (pipx-install scfw, run `scfw configure` to route pip/npm/poetry through the firewall via shell aliases, smoke-test the pipeline with a dry run, and optionally install a Claude Code PreToolUse hook so the agent's own installs are vetted too) and review (confirm the firewall is still wired, read the local JSON Lines log for recent blocks/warnings, run `scfw audit` on installed packages, answer "did scfw block/see package X"). Client-side, install-time gate for a single developer machine — complements CI-side scanning, doesn't replace it. User-triggered only — activate when the user invokes `/security:scfw`, `/security:scfw setup`, `/security:scfw review`, or `/security:scfw audit`.
disable-model-invocation: true
---

# security-scfw

You are setting up and operating [Supply-Chain Firewall](https://github.com/DataDog/supply-chain-firewall) (`scfw`), Datadog's open-source tool that **blocks known-malicious npm, PyPI, and Poetry packages before they install**. It's the closest open-source analog to a registry-side "malicious package firewall": a client-side gate that inspects the full set of targets a package-manager command would pull, checks them against Datadog's malicious-packages dataset + OSV.dev (plus a recent-publish warning heuristic), and **auto-blocks known-malicious installs / prompts on warnings** before handing off to the real package manager.

This is a **reactive, known-bad gate** — it stops packages that have already been reported, not novel/zero-day malware via behavioral analysis. It complements, and does not replace, the CI/PR-side scanning in `[[security-socket]]` and `[[security-snyk]]`, and the endpoint inventory in `[[security-bumblebee]]`. For defense in depth, run it alongside them.

The skill has two modes:

- **Setup mode** — install `scfw`, wire `scfw configure` so plain `pip`/`npm`/`poetry` passively route through the firewall (this is what makes it part of the toolchain — no re-invoking this skill), smoke-test the pipeline, and optionally install a Claude Code hook. Once.
- **Review mode** — confirm the firewall is still wired, read the local log for recent blocks/warnings, audit installed packages, answer advisory lookups. Many times after.

## When to use

User-triggered only. Activate on:

- `/security:scfw` — pick mode automatically (review if scfw is installed and configured, setup otherwise).
- `/security:scfw setup` — force the install/configure flow even when already configured.
- `/security:scfw review` — confirm wiring + walk the recent log (if not configured, tell the user to run setup first and stop).
- `/security:scfw audit` — review mode, jump straight to auditing installed packages.

Do not self-activate on related phrasing ("scan my dependencies", "is this package safe", "supply chain"). Surface the slash command and let the user decide.

## Mode dispatch — run this first

```bash
HAS_SCFW=0; command -v scfw >/dev/null 2>&1 && HAS_SCFW=1
IS_CONFIGURED=0
for rc in "$HOME/.zshrc" "$HOME/.bashrc"; do
  [ -f "$rc" ] && grep -q "SCFW MANAGED BLOCK" "$rc" && IS_CONFIGURED=1
done
echo "HAS_SCFW=$HAS_SCFW  IS_CONFIGURED=$IS_CONFIGURED"
```

Branch:

- **No argument + `HAS_SCFW=1` + `IS_CONFIGURED=1`** → review mode (Phase R).
- **No argument + not both** → setup mode (Phase 0 onward).
- **`setup` argument** → setup mode regardless.
- **`review` argument + not configured** → tell the user "scfw isn't configured yet; run `/security:scfw setup` first" and stop.
- **`review` argument + configured** → review mode.
- **`audit` argument** → review mode, jump straight to the audit step (R.3).

`scfw` installs via `pipx`, which drops the binary in `~/.local/bin`. If `command -v scfw` comes back empty right after an install, that dir may not be on `PATH` yet — check `~/.local/bin/scfw` before concluding it's missing.

## Phase R — Review mode

You're here because scfw is installed and configured. Don't re-install or re-configure.

### R.1 — Confirm the firewall is still wired

```bash
scfw --version
grep -n "SCFW MANAGED BLOCK" "$HOME/.zshrc" "$HOME/.bashrc" 2>/dev/null
# In a fresh interactive shell the aliases resolve to the firewall:
zsh -ic 'type pip; type npm; type poetry' 2>/dev/null || bash -ic 'type pip npm poetry' 2>/dev/null
```

Report whether the managed block is present and which managers are aliased (`pip`/`npm`/`poetry` should show `scfw run …`). If the block is gone, the firewall is off for new shells — offer to re-run setup's configure step.

### R.2 — Recent firewall activity

The local log is JSON Lines, one record per `scfw run`/`scfw audit`. It only exists if `SCFW_HOME` (or `SCFW_LOG_FILE`) was set — setup's `--scfw-home` does that. Default path:

```bash
LOG="${SCFW_HOME:-$HOME/.scfw}/scfw.log"
[ -f "$LOG" ] || echo "no local log at $LOG (was scfw configured with --scfw-home / SCFW_HOME?)"

echo "=== action tally ==="
jq -r '.action // empty' "$LOG" 2>/dev/null | sort | uniq -c
echo "=== recent blocks ==="
jq -c 'select(.action=="BLOCK")' "$LOG" 2>/dev/null | tail -20
echo "=== recent warnings ==="
jq -c 'select(.warning==true)' "$LOG" 2>/dev/null | tail -20
```

Walk the user through any `BLOCK` records (a malicious package was stopped — note the `install_targets` and `relevant_findings`) and warnings. Records carry `ecosystem`, `package_manager`, `action`, `warning`, and (when present) `install_targets` / `relevant_findings`. Only commands run in an aliased **interactive** shell are logged here — the agent's own `scfw run` calls in a non-interactive shell usually aren't (no `SCFW_HOME` in that environment).

### R.3 — Audit installed packages (`audit`)

`scfw audit` re-checks what's *already* installed against the same verifiers — useful when a new advisory lands:

```bash
scfw audit pip
scfw audit npm
scfw audit poetry
# For a project venv, point at its executable:
scfw audit --executable .venv/bin/pip pip
```

Run only the managers relevant to the project. Report any findings; a clean audit is the expected, good outcome.

### R.4 — Advisory lookup ("did scfw see/block package X")

```bash
PKG="<package name>"
LOG="${SCFW_HOME:-$HOME/.scfw}/scfw.log"
jq -c --arg p "$PKG" 'select((.install_targets // .audited_packages // [] | tostring) | test($p; "i"))' "$LOG" 2>/dev/null
```

Report the matching records (when it was seen, what action was taken). If nothing matches, say so — and if the log is sparse, suggest an `scfw audit` for a definitive current-state answer rather than relying on log history.

### R.5 — Stop

Review mode is conversational. After R.1/R.2, wait for the user to ask. Don't proactively run R.3/R.4 unless they ask to audit or name a package.

---

The rest of this file is **setup mode**. Skip it if you're in review mode.

## Phase 0 — Hard prerequisites

```bash
uname -s                     # scfw is fully supported on macOS, best-effort on Linux, NOT on Windows
command -v python3           # scfw is a Python tool
command -v pipx || command -v pip3   # pipx strongly preferred (isolated install)
command -v jq                # for reading the JSON Lines log in review mode + the optional hook
```

- **Windows (`MINGW*`/`MSYS*`/`CYGWIN*`)** → stop. scfw doesn't support Windows; point the user at WSL.
- scfw only guards **npm (≥7), pip (≥22.2), and Poetry (≥1.7)**. Ask which the user actually uses, and check versions — scfw refuses to run against unsupported package-manager versions. Note that `uv`, `pnpm`, and `yarn` are **not** covered.

## Phase 1 — Install scfw

**Hand the install to the user.** Installing a tool is a trust decision, and strict permission classifiers block agents from doing it unattended. Print the command and ask them to run it (in Claude Code, prefix with `!` so the output lands in the transcript):

```bash
! pipx install scfw
```

Fallback if `pipx` isn't available: `pip install --user scfw` (or inside a virtualenv). After they report it finished, verify (safe to run agent-side):

```bash
scfw --version   # expect 3.x
```

If `command -v scfw` is empty, try `~/.local/bin/scfw --version` and tell the user to add `~/.local/bin` to `PATH` (`pipx ensurepath`).

## Phase 2 — Configure the firewall (this is the toolchain integration)

`scfw configure` writes a `# BEGIN SCFW MANAGED BLOCK … # END SCFW MANAGED BLOCK` region into `~/.bashrc` and `~/.zshrc` (**only files that already exist**), adding shell aliases like `alias pip="scfw run pip"` so every install passively routes through the firewall, plus an `export SCFW_HOME=…` that turns on the local JSON Lines log review mode reads.

**Hand this to the user too** — it edits their shell rc (persistence) and, run bare, is an interactive wizard. Give them the non-interactive form, tailored to the managers they use, and always include `--scfw-home` so logging is on:

```bash
! scfw configure --scfw-home "$HOME/.scfw" --alias-pip --alias-npm --alias-poetry
```

Drop any `--alias-*` for a manager they don't use. (Bare `! scfw configure` runs the guided wizard instead — offer it if they prefer prompts.)

Notes:
- The block is only added to rc files that **exist**. A zsh user with no `~/.zshrc` won't get aliased — have them `touch ~/.zshrc` first (or run the wizard, which handles home dir setup).
- Aliases take effect in **new** shells; in the current one, `source ~/.zshrc` (or `~/.bashrc`).
- Verify:
  ```bash
  grep -n "SCFW MANAGED BLOCK" "$HOME/.zshrc" "$HOME/.bashrc" 2>/dev/null
  zsh -ic 'type pip' 2>/dev/null || bash -ic 'type pip' 2>/dev/null   # should show: pip is an alias for scfw run pip
  ```

Explain the behavior the user will now see on every install: **known-malicious → auto-blocked; a vulnerability or very-recently-published package → a `[y/N]` prompt; clean → installs normally.**

## Phase 3 — Smoke-test the pipeline

Prove the firewall is in the path **without mutating the environment or touching real malware** — `--dry-run` verifies the targets and exits without installing:

```bash
! scfw run --dry-run pip install requests
```

Expect it to resolve/verify `requests` (and its deps) and report no findings, then stop short of installing. If the user aliased npm/poetry, a matching `scfw run --dry-run npm install <pkg>` works too. This confirms scfw is wired and reaching its data sources. (Do **not** attempt to install a known-malicious package to "prove" blocking — trust the dry run.)

## Phase 4 — (Optional) Protect Claude Code's own installs with a hook

Ask the user:

> The `scfw configure` aliases only cover your **interactive** shell. When Claude Code runs `pip install` / `npm install` / `poetry add` itself (non-interactive Bash), it bypasses them. Want me to install a small PreToolUse hook that blocks the agent's un-wrapped installs so they must go through `scfw run`?

If **no**, skip to Phase 5. If **yes**, the hook (`scripts/scfw-guard.sh`) inspects the agent's Bash commands and:

- **pip / npm / poetry install** not already prefixed with `scfw run` → **denies** it and tells the agent to re-issue it through `scfw run` (where scfw vets the targets).
- **bun / pnpm install** → **flags** it for a human decision (`ask`). scfw can't run bun/pnpm, but their packages come from the npm registry and would enter *outside* the firewall — so the hook surfaces that blind spot rather than silently allowing or pretending it's vetted.
- everything else → allowed silently.

Wiring it into `settings.json` is a persistence change — hand it to the user:

After it's wired, verify by asking the agent to run a bare `pip install <something>` — it should be blocked with the `scfw run` guidance; `scfw run pip install <something>` passes through.

## Phase 5 — Summary + ongoing use

Tell the user:

```
scfw installed and configured. From now on, just use pip / npm / poetry as usual —
they route through the Supply-Chain Firewall automatically in new shells.

  known-malicious  → auto-blocked
  vuln / very new  → [y/N] prompt
  clean            → installs normally

Local log:  ${SCFW_HOME:-~/.scfw}/scfw.log   (JSON Lines)
Agent hook: <installed / not installed>

Ongoing:
  /security:scfw review   # confirm wiring + walk recent blocks/warnings
  /security:scfw audit    # re-check already-installed packages against the feeds

Remove everything:
  scfw configure --remove                                   # drop shell aliases/exports
  ~/.claude/skills/security-scfw/scripts/install.sh --remove  # if you installed the agent hook
  pipx uninstall scfw
```

## Notes

- **Bypass model.** Aliases only fire in interactive shells; the optional hook covers Claude Code's own installs; **CI is not covered** — for un-bypassable enforcement in pipelines, add an explicit `scfw run` step to the CI job. Mention this if the user asks about team/CI coverage; it's out of scope for this per-machine setup.
- **Reactive, not behavioral.** Data sources are Datadog's malicious-packages dataset + OSV.dev + a recent-publish warning. It catches *known* bad packages and known vulns, not novel malware. Pair with `[[security-socket]]` / `[[security-snyk]]`.
- **Supported scope.** scfw vets **npm, pip, and Poetry only** — its supported-manager list is hardcoded, and package managers (unlike verifiers/loggers) aren't pluggable, so `bun`/`pnpm`/`uv`/`yarn` can't be added without patching scfw. bun and pnpm pull from the npm registry, so the *data* would cover them, but scfw can't resolve their install targets. The optional hook therefore **flags** bun/pnpm installs as outside the firewall (awareness only) rather than pretending to vet them. macOS fully supported, Linux best-effort, no Windows.
- **Going further (out of scope here, mention on request):** custom verifiers can add data sources (a `verifier.py` template ships with scfw — e.g. wiring the `ossf/malicious-packages` OSV feed, whose local list lives under `$SCFW_HOME/`); `scfw configure` can forward logs to Datadog (`--dd-api-logger` / `--dd-agent-port` with `DD_API_KEY`) for fleet observability.
