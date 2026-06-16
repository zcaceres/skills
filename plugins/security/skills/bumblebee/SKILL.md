---
name: bumblebee
description: Set up and use Perplexity's bumblebee endpoint scanner for supply-chain exposure checks. Two modes — setup (install the Go binary, pick an output directory, run a first baseline scan, optionally schedule recurring scans and wire up an exposure catalog) and review (read the latest scan, answer advisory lookups like "did I have package X@Y installed", surface drift since the prior scan, optionally re-run with the catalog). Aimed at single developers and small teams (no MDM, no SIEM). User-triggered only — activate when the user invokes `/security:bumblebee`, `/security:bumblebee review`, `/security:bumblebee check <package>`, or `/security:bumblebee setup`.
disable-model-invocation: true
---

# security-bumblebee

You are running [bumblebee](https://github.com/perplexityai/bumblebee), Perplexity's read-only endpoint inventory scanner, on the user's machine. Unlike [[security-snyk]] and [[security-socket]], which scan repos in CI, bumblebee runs **locally** and tells you which packages, editor extensions, browser extensions, and MCP server configs are present on disk *right now* — useful when an advisory drops and you need to know whether you're exposed.

The skill has two modes:

- **Setup mode** — install the binary, run a first baseline scan, optionally schedule recurring scans and wire up an exposure catalog. Once.
- **Review mode** — read the latest scan, surface what's new since the prior one, answer questions like "did I have package X@Y installed last week", optionally re-run the catalog-augmented scan. Many times after.

This is endpoint-side tooling, not CI tooling. Don't try to integrate it with GitHub — there's no GitHub App here. The "value" is a local NDJSON log the agent (or the user) can grep when advisories land.

## When to use

User-triggered only. Activate on:
- `/security:bumblebee` — pick mode automatically (review if a baseline exists, setup otherwise).
- `/security:bumblebee setup` — force the install/baseline flow even when a baseline already exists.
- `/security:bumblebee review` — force review mode even when no `current.ndjson` is present (in which case: tell the user to run setup first and stop).
- `/security:bumblebee check <package>` — direct advisory lookup against the latest scan.
- `/security:bumblebee rescan` — re-run the catalog-augmented scan against fresh data.

Do not self-activate on related phrasing ("scan my machine", "check supply chain", "did I install X"). Surface the slash command and let the user decide.

## Mode dispatch — run this first

Before anything else, decide which mode you're in:

```bash
BUMBLEBEE_DIR_DEFAULT_MAC="$HOME/Library/Logs/bumblebee"
BUMBLEBEE_DIR_DEFAULT_LINUX="${XDG_STATE_HOME:-$HOME/.local/state}/bumblebee"
if [ "$(uname -s)" = "Darwin" ]; then
  BUMBLEBEE_DIR="$BUMBLEBEE_DIR_DEFAULT_MAC"
else
  BUMBLEBEE_DIR="$BUMBLEBEE_DIR_DEFAULT_LINUX"
fi
HAS_BASELINE=0
[ -L "$BUMBLEBEE_DIR/current.ndjson" ] && [ -r "$BUMBLEBEE_DIR/current.ndjson" ] && HAS_BASELINE=1
echo "BUMBLEBEE_DIR=$BUMBLEBEE_DIR  HAS_BASELINE=$HAS_BASELINE"
```

Branch:

- **No invocation argument + `HAS_BASELINE=1`** → review mode (Phase R below).
- **No invocation argument + `HAS_BASELINE=0`** → setup mode (Phase 0 through Phase 6 below).
- **`setup` argument** → setup mode regardless.
- **`review` argument + `HAS_BASELINE=0`** → tell the user "no baseline at `$BUMBLEBEE_DIR/current.ndjson`; run `/security:bumblebee setup` first" and stop.
- **`review` argument + `HAS_BASELINE=1`** → review mode.
- **`check <package>` argument + `HAS_BASELINE=1`** → review mode, jump straight to the advisory-lookup step with `<package>` as input.
- **`rescan` argument + `HAS_BASELINE=1`** → review mode, jump straight to the catalog re-scan step.

If the user honored a non-default `BUMBLEBEE_DIR` during setup (e.g. synced cloud dir), let them override here: ask once if `current.ndjson` isn't where you expect.

## Phase R — Review mode

You are here because a baseline scan already exists. Don't re-install, don't re-run setup phases.

### R.1 — Summarize the latest scan

Read `$BUMBLEBEE_DIR/current.ndjson` (a symlink to the most recent successful scan):

```bash
OUT="$BUMBLEBEE_DIR/current.ndjson"

# Resolve symlink to the actual file + report its age
REAL="$(readlink "$OUT")"
TS_LINE="$(jq -r 'select(.record_type=="scan_summary") | "scan_time=\(.scan_time) status=\(.status) duration_ms=\(.duration_ms)"' "$OUT")"

# Record-type and ecosystem tally
echo "=== record_type tally ==="
jq -r '.record_type' "$OUT" | sort | uniq -c
echo "=== ecosystem counts (packages) ==="
jq -r 'select(.record_type=="package") | .ecosystem' "$OUT" | sort | uniq -c | sort -rn

# Any findings? (only present if the scan used --exposure-catalog)
echo "=== findings ==="
jq -c 'select(.record_type=="finding")' "$OUT"
```

Report to the user in plain prose: when the scan ran (`scan_time`), how long it took, total packages by ecosystem, and any `finding` records. If the scan is more than ~14 days old, say so — fresh data matters when advisories land.

**Recognize the selftest-fixture noise** as in setup-mode Phase 3: if `ghcr.io/bumblebee-selftest/evil-mcp` appears, call it out as "scanner's own test fixture" rather than flagging it.

### R.2 — Drift since the prior scan

If there are at least two `scan-*.ndjson` files in `$BUMBLEBEE_DIR`, surface what changed. Newly-installed packages are the high-signal answer to "what should I look at":

```bash
LATEST="$(readlink -f "$BUMBLEBEE_DIR/current.ndjson")"
PRIOR="$(ls -1t "$BUMBLEBEE_DIR"/scan-*.ndjson 2>/dev/null | grep -v "$(basename "$LATEST")" | head -1)"
if [ -n "$PRIOR" ]; then
  echo "Comparing $(basename "$PRIOR") -> $(basename "$LATEST")"
  diff \
    <(jq -r 'select(.record_type=="package") | "\(.ecosystem)\t\(.package_name)\t\(.version // "")"' "$PRIOR" | sort -u) \
    <(jq -r 'select(.record_type=="package") | "\(.ecosystem)\t\(.package_name)\t\(.version // "")"' "$LATEST" | sort -u) \
    | grep -E '^[<>]' | head -50
fi
```

`>` lines are newly present; `<` lines disappeared. Walk through anything notable — a new MCP server the user doesn't remember installing, a wallet extension that appeared on a profile, a `package_manager: docker` MCP that just showed up. The agent's job is to **notice and ask**, not to act.

### R.3 — Advisory lookup (`check <package>`)

When the user asks "did I have X installed", or invoked with `check <package>`:

```bash
PKG="<argument>"
jq -c "select(.record_type==\"package\" and (.package_name | test(\"$PKG\"; \"i\")))" "$OUT"
```

Report each match's `ecosystem`, `version`, `source_file`, and `package_manager`. If `version` is in a range the user gave you (e.g. "any 4.x"), filter further. If zero matches, say "not in the last scan" — and if the last scan is stale, suggest a rescan before concluding.

### R.4 — Optional re-scan with catalog

If the user wants a fresh exposure check (advisory just dropped, scheduled scan hasn't happened yet), jump to setup-mode Phase 5's "run the catalog scan" command — same `--exposure-catalog --findings-only` pattern, written to a script, user-run via `!`. Don't re-fetch catalogs unless the user asks; older catalogs are still useful for retrospective lookups.

### R.5 — Stop

Review mode is conversational. After R.1/R.2, wait for the user to ask a question. Don't proactively run R.3 unless they name a package, don't proactively run R.4 unless they ask for a fresh scan.

---

The rest of this file is **setup mode**. Skip it if you're in review mode.

## Hard prerequisites — check before doing anything

```bash
uname -s          # darwin or linux; bumblebee doesn't support windows
command -v go     # for go install path
command -v jq     # for reading NDJSON in later phases
```

Capture:
- `OS` — `darwin` or `linux`.
- `HAS_GO` — true if `go version` reports `1.25+`.

**No Go 1.25+?** Bumblebee depends on it. Offer two paths:
1. `brew install go` (macOS) / package manager install (Linux), then `go install`.
2. Download a prebuilt binary from the releases page — `gh release download --repo perplexityai/bumblebee` if `gh` is available. Pick the tarball matching `uname -m`.

Don't proceed until `bumblebee version` runs.

## Phase 1 — Install

**Hand the install to the user.** Installing a binary from a third-party Go module path is a meaningful trust decision — and several permission classifiers (Claude Code's auto mode, sandboxed harnesses, MDM-managed Macs) will block an agent from doing it unattended. Print the command, explain what it does, and ask the user to run it themselves. In Claude Code, prefix with `!` to run it in the current session so the output lands in the transcript:

```bash
! go install github.com/perplexityai/bumblebee/cmd/bumblebee@latest
```

Fallback — prebuilt release tarball (still user-run):

```bash
! gh release download --repo perplexityai/bumblebee --pattern "*$(uname -s | tr A-Z a-z)*$(uname -m)*.tar.gz" --dir /tmp/bumblebee && tar -xzf /tmp/bumblebee/*.tar.gz -C ~/.local/bin
```

After the user reports the install finished, *then* the agent runs the verification commands (these are safe to execute — they just exercise the installed binary).

First, resolve the binary path. `go install` drops the binary in `$(go env GOPATH)/bin` (default `~/go/bin`), and that directory is **not** on `PATH` by default on most setups — so `command -v bumblebee` will commonly return nothing even though the install succeeded. Fall back to the Go bin dir:

```bash
BUMBLEBEE_BIN="$(command -v bumblebee || true)"
if [ -z "$BUMBLEBEE_BIN" ]; then
  BUMBLEBEE_BIN="$(go env GOBIN)/bumblebee"
  [ -x "$BUMBLEBEE_BIN" ] || BUMBLEBEE_BIN="$(go env GOPATH)/bin/bumblebee"
fi
echo "$BUMBLEBEE_BIN"
```

If `BUMBLEBEE_BIN` was resolved via the fallback (not on `PATH`), mention to the user that they may want to add `export PATH="$(go env GOPATH)/bin:$PATH"` to their shell rc — not required for this skill (we use the absolute path everywhere), but nicer for ad-hoc use.

Then run version + selftest:

```bash
"$BUMBLEBEE_BIN" version
"$BUMBLEBEE_BIN" selftest
```

`selftest` runs against embedded fake-package fixtures and makes no network calls. Expect a line starting with `selftest OK` (the trailing `(N findings in …ms)` count changes as upstream adds fixtures — don't pin it). If it fails, the install is broken — stop and surface the error.

Phase 3 and Phase 4 use the resolved `BUMBLEBEE_BIN` everywhere, so the skill works regardless of install layout (`go install` to default GOPATH, custom `GOBIN`, prebuilt tarball in `/usr/local/bin`, etc.).

## Phase 2 — Pick the scan output directory

The scanner emits NDJSON. We want it somewhere the user can grep later and the agent can read on demand. Pick per OS:

- **macOS**: `~/Library/Logs/bumblebee/` — Apple's convention for log-like persistent output.
- **Linux**: `"${XDG_STATE_HOME:-$HOME/.local/state}/bumblebee/"` — XDG-spec state dir.

```bash
if [ "$(uname -s)" = "Darwin" ]; then
  BUMBLEBEE_DIR="$HOME/Library/Logs/bumblebee"
else
  BUMBLEBEE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/bumblebee"
fi
mkdir -p "$BUMBLEBEE_DIR"
echo "$BUMBLEBEE_DIR"
```

Record `BUMBLEBEE_DIR` — every later phase uses it.

If the user has a strong opinion about output location (e.g. they want it in `~/.bumblebee/` or a synced cloud dir), honor it. The cron entry in Phase 4 will use whatever the user picked.

## Phase 3 — Run a first baseline scan and surface findings

**Hand the first scan to the user** for the same reason as Phase 1 — strict permission classifiers (Claude Code auto mode, sandboxed harnesses) treat running a freshly-installed third-party binary as "externally-sourced code execution" and will block the agent.

**Don't paste a long single-line one-liner.** When the user's terminal soft-wraps the line — which happens in Claude Code, Ghostty, iTerm with line wrap on, anything narrower than the command — the `$(...)` substitutions and quoted-string boundaries can fracture across lines and zsh will silently run the fragments as separate commands. The observed failure mode: `TS="$(date +%Y%m%d-%H%M%S)"` splits, `+%Y%m%d-%H%M%S` runs as its own command and dies with `command not found`, `TS` ends up empty, and the scan output gets named `scan-Thu Jun 11 …ndjson` (literal `date` with no format string somewhere later in the pipeline).

Write the scan command to a tiny script the user can invoke instead. Less to mistype, no paste-wrap fragility:

```bash
cat >"$BUMBLEBEE_DIR/run-scan.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
: "${BUMBLEBEE_BIN:?set BUMBLEBEE_BIN}"
: "${BUMBLEBEE_DIR:?set BUMBLEBEE_DIR}"
TS="$(date +%Y%m%d-%H%M%S)"
OUT="$BUMBLEBEE_DIR/scan-$TS.ndjson"
ERR="$BUMBLEBEE_DIR/scan-$TS.stderr"
if "$BUMBLEBEE_BIN" scan --profile baseline >"$OUT" 2>"$ERR" \
   && jq -e 'select(.record_type=="scan_summary" and .status=="ok")' "$OUT" >/dev/null; then
  ln -sf "scan-$TS.ndjson" "$BUMBLEBEE_DIR/current.ndjson"
  printf 'promoted current.ndjson -> scan-%s.ndjson\n' "$TS"
else
  printf 'bumblebee: scan failed or status != ok; current.ndjson left unchanged\n' >&2
  exit 1
fi
wc -l "$OUT"
EOF
chmod +x "$BUMBLEBEE_DIR/run-scan.sh"
```

Then ask the user to run it via `!`:

```bash
! BUMBLEBEE_BIN="<path from Phase 1>" BUMBLEBEE_DIR="<path from Phase 2>" ~/Library/Logs/bumblebee/run-scan.sh
```

The gate (`exit cleanly && scan_summary.status == "ok"`) means a failed or partial scan leaves `current.ndjson` pointing at the last good run. (`jq` is a Phase 0 prerequisite; the gate fails closed if it's missing.)

Once the user has run it once and the binary has earned their trust, they can add a Bash permission rule for `bumblebee scan` so re-runs work agent-side. The skill doesn't decide that for them.

### Expected noise — don't alarm the user

Bumblebee scans `~/go` as a `user_package_root`, which sweeps up the Go module cache — including bumblebee's *own* selftest fixtures at `~/go/pkg/mod/github.com/perplexityai/bumblebee@vX.Y.Z/cmd/bumblebee/selftest/fixtures/mcp-fixture/mcp.json`. That's why the baseline scan reports an MCP server named `ghcr.io/bumblebee-selftest/evil-mcp` with `server_name: "bumblebee-selftest-mcp"`. **It's a file-on-disk fixture, nothing is wired up, nothing runs.** When surfacing the MCP list to the user, recognize this record and call it out as "scanner's own test fixture" instead of flagging it as suspicious. (Filed as a known footgun — upstream may eventually exclude its own module path from the package-root walk.)

`baseline` covers global package roots, language toolchains, editor extensions, browser extensions, and MCP configs. It refuses bare `$HOME` — that's what `--profile deep` is for, and we don't run that here without an exposure catalog.

Then **read the file and report**:

```bash
# Summary by record type
jq -r '.record_type' "$OUT" | sort | uniq -c

# Summary by ecosystem (packages only)
jq -r 'select(.record_type=="package") | .ecosystem' "$OUT" \
  | sort | uniq -c | sort -rn

# Any findings? (only present if --exposure-catalog was passed — usually zero on the first run)
jq -c 'select(.record_type=="finding")' "$OUT"

# The scan_summary record — final-line tally
jq -c 'select(.record_type=="scan_summary")' "$OUT"
```

Report to the user in plain prose:
- Total package records, broken down by ecosystem.
- Anything surprising — old `npm` packages, MCP servers they don't remember installing, browser extensions on profiles they thought they'd deleted. The agent's job is to **notice and ask**, not to act.
- Any `finding` records (zero is expected without a catalog).
- The `scan_summary` row's status (`ok`, `partial`, etc.).

If the user is curious about a specific package or MCP server they spot, `jq -c 'select(.package_name=="...")' "$OUT"` returns the full record.

## Phase 4 — (Optional) Schedule recurring scans

Ask the user: "Want bumblebee to run on a schedule so we have fresh data when an advisory drops?" Default suggestion: **weekly**. Daily is fine but noisy.

### macOS — launchd

Write `~/Library/LaunchAgents/dev.bumblebee.scan.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>            <string>dev.bumblebee.scan</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string><string>-c</string>
    <string>OUT="__BUMBLEBEE_DIR__/scan-$(date +%Y%m%d-%H%M%S).ndjson"; "__BUMBLEBEE_BIN__" scan --profile baseline &gt; "$OUT" 2&gt;"${OUT%.ndjson}.stderr" &amp;&amp; "__JQ_BIN__" -e 'select(.record_type=="scan_summary" and .status=="ok")' "$OUT" &gt;/dev/null &amp;&amp; ln -sf "$(basename "$OUT")" "__BUMBLEBEE_DIR__/current.ndjson"</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Weekday</key><integer>1</integer>
    <key>Hour</key><integer>9</integer>
    <key>Minute</key><integer>0</integer>
  </dict>
  <key>RunAtLoad</key>        <false/>
  <key>StandardErrorPath</key><string>__BUMBLEBEE_DIR__/launchd.stderr</string>
  <key>StandardOutPath</key>  <string>__BUMBLEBEE_DIR__/launchd.stdout</string>
</dict>
</plist>
```

Substitute three placeholders before writing:
- `__BUMBLEBEE_DIR__` — from Phase 2
- `__BUMBLEBEE_BIN__` — from Phase 1
- `__JQ_BIN__` — `$(command -v jq)` (`/opt/homebrew/bin/jq` on most macOS setups). launchd's `PATH` is minimal and a bare `jq` resolves to nothing, which silently fails the gate and leaves the symlink unchanged on every scheduled run.

The agent can write the plist directly (it's just a file in `~/Library/LaunchAgents/`, trivially removable).

**Don't `launchctl load` agent-side.** Activating the scheduled job is "establishing persistence beyond the current session" — permission classifiers in Claude Code auto mode and other sandboxed harnesses block this even when the user just consented in the chat, because they evaluate per-action without conversation context. Print the load command and ask the user to run it themselves via `!`:

```bash
! plutil -lint ~/Library/LaunchAgents/dev.bumblebee.scan.plist && launchctl load ~/Library/LaunchAgents/dev.bumblebee.scan.plist && launchctl list | grep dev.bumblebee.scan
```

`plutil -lint` catches XML/escape mistakes before launchd silently rejects the file. After load, the listing should show the job's label with its last exit status. The job runs every Monday at 09:00 local (`Weekday` 0 is Sunday; adjust to taste).

To remove later: `launchctl unload ~/Library/LaunchAgents/dev.bumblebee.scan.plist && rm ~/Library/LaunchAgents/dev.bumblebee.scan.plist`. Tell the user this when you hand them the install command — persistence they don't know how to undo is a footgun.

### Linux — cron

```bash
# crontab -e and add (substitute __BUMBLEBEE_DIR__ and __BUMBLEBEE_BIN__):
0 9 * * 1 OUT="__BUMBLEBEE_DIR__/scan-$(date +\%Y\%m\%d-\%H\%M\%S).ndjson"; "__BUMBLEBEE_BIN__" scan --profile baseline > "$OUT" 2>"${OUT\%.ndjson}.stderr" && jq -e 'select(.record_type=="scan_summary" and .status=="ok")' "$OUT" >/dev/null && ln -sf "$(basename "$OUT")" "__BUMBLEBEE_DIR__/current.ndjson"
```

Don't write this agent-side. cron entries are persistence, easy to forget, and accumulate. Print the proposed line and have the user pipe it into `crontab -` themselves (`! (crontab -l 2>/dev/null; echo '<proposed line>') | crontab -`). Tell them how to remove it (`crontab -e`, delete the line). Don't proceed if they hesitate.

The `&&` chain matters: it ensures the `current.ndjson` symlink is only repointed if the scan exits cleanly *and* the `scan_summary` row reports `status=="ok"`. A scheduled job that crashes mid-walk, or emits `status=="partial"`, leaves the prior good pointer intact instead of clobbering it with a truncated file. Note: if the binary location changes later (`brew upgrade`, rebuild to a different `GOBIN`), the scheduler will exit 127 and the symlink stays put — re-run `/security:bumblebee` to refresh the entries.

### Pruning

NDJSON files are small (KB, not MB) but accumulate. Suggest the user add a quarterly prune:

```bash
# Keep the last 90 days
find "$BUMBLEBEE_DIR" -name 'scan-*.ndjson' -mtime +90 -delete
```

## Phase 5 — (Optional) Wire up an exposure catalog

Without a catalog, scans only emit `package`/`mcp`/`extension` records. With one, scans also emit `finding` records when an `(ecosystem, name, version)` tuple matches.

Bumblebee ships maintained sample catalogs in [`threat_intel/`](https://github.com/perplexityai/bumblebee/tree/main/threat_intel) built from public advisories. The **catalog fetch can be agent-run** if you use the GitHub API to download each `.json` directly (inert data — no code), but the **re-scan needs a user-run command** because executing the freshly-installed third-party binary trips the same classifier as Phase 3.

Preferred (agent-runnable) catalog fetch — uses `gh api` to list `threat_intel/`, then `curl` to download each JSON. No repo clone, no working tree:

```bash
CATALOG_DIR="$BUMBLEBEE_DIR/catalogs"
mkdir -p "$CATALOG_DIR"
gh api repos/perplexityai/bumblebee/contents/threat_intel \
  --jq '.[] | select(.name|endswith(".json")) | "\(.name)\t\(.download_url)"' \
  | while IFS=$'\t' read -r name url; do
      curl -sSL -o "$CATALOG_DIR/$name" "$url"
    done
ls "$CATALOG_DIR/"
```

Fallback (user-runnable) — full clone. Use this when the agent's GitHub API call is blocked by the classifier:

```bash
! mkdir -p "$BUMBLEBEE_DIR/catalogs" && gh repo clone perplexityai/bumblebee /tmp/bumblebee-source -- --depth=1 && cp /tmp/bumblebee-source/threat_intel/*.json "$BUMBLEBEE_DIR/catalogs/" && ls "$BUMBLEBEE_DIR/catalogs/"
```

If the user already has a bumblebee clone somewhere, point them at it: `cp <their-clone>/threat_intel/*.json "$BUMBLEBEE_DIR/catalogs/"`.

After the clone, the agent can read the catalog JSON files freely (they're just data — no execution). Skim them to tell the user what coverage they have: ecosystems represented, total advisories, date range of the most recent entries. This sets expectations before the re-scan.

Then hand the user the catalog-augmented scan command. Write it to a script for the same paste-wrap reasons as Phase 3:

```bash
cat >"$BUMBLEBEE_DIR/run-findings.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
: "${BUMBLEBEE_BIN:?set BUMBLEBEE_BIN}"
: "${BUMBLEBEE_DIR:?set BUMBLEBEE_DIR}"
TS="$(date +%Y%m%d-%H%M%S)"
OUT="$BUMBLEBEE_DIR/findings-$TS.ndjson"
"$BUMBLEBEE_BIN" scan --profile baseline \
  --exposure-catalog "$BUMBLEBEE_DIR/catalogs" \
  --findings-only \
  >"$OUT"
printf 'findings written to: %s (%s lines)\n' "$OUT" "$(wc -l <"$OUT")"
EOF
chmod +x "$BUMBLEBEE_DIR/run-findings.sh"
```

```bash
! BUMBLEBEE_BIN="<path>" BUMBLEBEE_DIR="<path>" ~/Library/Logs/bumblebee/run-findings.sh
```

`--findings-only` drops package records and keeps the output small — good for "did anything match?" pings. Don't use it for inventory; use it for advisory response.

After the user runs it, the agent reads the findings NDJSON and walks through what matched. A clean run with zero findings is the expected — and good — outcome.

## Phase 6 — End-of-session summary

Tell the user:

```
Installed bumblebee. Scan output at: __BUMBLEBEE_DIR__/

First baseline scan: scan-__TS__.ndjson
  __N__ packages across __M__ ecosystems

Recurring scan: __scheduled / not scheduled__
Exposure catalog: __configured / not configured__

Next time an advisory drops:
  /security:bumblebee check <package>   # direct lookup
  /security:bumblebee review            # walk through the latest scan + drift
  /security:bumblebee rescan            # fresh catalog scan against current state
```

## Notes

- **Don't scan with `--profile deep` interactively.** It walks bare `$HOME` and takes minutes. Reserve it for explicit on-demand advisory checks with a catalog.
- **Don't emit MCP config `env` values.** Bumblebee already strips these by design — but if you write any scripts that re-parse the configs, do the same.
- **No fleet plumbing.** This skill is for one machine. If the user mentions "deploy this to 50 laptops" or "ship to SIEM", point them at the upstream README's MDM / transport docs and stop — that's a different shape of work.
- **Related skills.** [[security-snyk]] and [[security-socket]] cover the CI / PR-time side. Bumblebee covers the endpoint side. They're complementary, not overlapping.
