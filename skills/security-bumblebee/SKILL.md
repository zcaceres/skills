---
name: security-bumblebee
description: Set up Perplexity's bumblebee endpoint scanner on the user's machine for supply-chain exposure checks. Installs the Go binary, picks an OS-appropriate output directory for NDJSON scan records, runs a first baseline scan, helps the agent read the resulting findings, and optionally schedules recurring scans via cron or launchd. Aimed at single developers and small teams (no MDM, no SIEM). User-triggered only — activate when the user invokes `/security-bumblebee`.
---

# security-bumblebee

You are setting up [bumblebee](https://github.com/perplexityai/bumblebee), Perplexity's read-only endpoint inventory scanner, on the user's machine. Unlike [[security-snyk]] and [[security-socket]], which scan repos in CI, bumblebee runs **locally** and tells you which packages, editor extensions, browser extensions, and MCP server configs are present on disk *right now* — useful when an advisory drops and you need to know whether you're exposed.

The skill's job is:

1. Install the binary and confirm it works.
2. Pick a sensible directory for scan output (NDJSON) on the user's OS.
3. Run a first **baseline** scan, save the output, and walk through what it found.
4. Optionally schedule a recurring scan (cron on Linux, launchd on macOS).
5. Optionally wire up an exposure catalog so future scans flag known-bad versions.

This is endpoint-side tooling, not CI tooling. Don't try to integrate it with GitHub — there's no GitHub App here. The "value" is a local NDJSON log the agent (or the user) can grep when advisories land.

## When to use

User-triggered only. Activate when the user invokes `/security-bumblebee`. Do not self-activate on related phrasing ("scan my machine", "check supply chain", "did I install X"). Surface the slash command and let the user decide.

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

```bash
go install github.com/perplexityai/bumblebee/cmd/bumblebee@latest
bumblebee version
bumblebee selftest
```

`selftest` runs against embedded fake-package fixtures and makes no network calls. Expect `selftest OK (2 findings in ...)`. If it fails, the install is broken — stop and surface the error.

Once selftest passes, record the resolved binary path. Phase 4 substitutes it into the scheduler entries so they work regardless of install layout (`go install` with custom `GOBIN`, prebuilt tarball in `/usr/local/bin`, etc.):

```bash
BUMBLEBEE_BIN="$(command -v bumblebee)"
echo "$BUMBLEBEE_BIN"
```

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

```bash
TS="$(date +%Y%m%d-%H%M%S)"
OUT="$BUMBLEBEE_DIR/scan-$TS.ndjson"
# Promote current.ndjson only if the scan exits cleanly AND scan_summary.status == "ok".
# Failed or partial scans must not clobber the last-good pointer. (jq dep is required by
# Phase 0; the gate fails closed if it's missing.)
if bumblebee scan --profile baseline > "$OUT" 2>"$BUMBLEBEE_DIR/scan-$TS.stderr" \
  && jq -e 'select(.record_type=="scan_summary" and .status=="ok")' "$OUT" >/dev/null; then
  ln -sf "scan-$TS.ndjson" "$BUMBLEBEE_DIR/current.ndjson"
else
  echo "bumblebee: scan failed or status != ok; current.ndjson left unchanged" >&2
fi
wc -l "$OUT"
```

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
    <string>OUT="__BUMBLEBEE_DIR__/scan-$(date +%Y%m%d-%H%M%S).ndjson"; "__BUMBLEBEE_BIN__" scan --profile baseline &gt; "$OUT" 2&gt;"${OUT%.ndjson}.stderr" &amp;&amp; jq -e 'select(.record_type=="scan_summary" and .status=="ok")' "$OUT" &gt;/dev/null &amp;&amp; ln -sf "$(basename "$OUT")" "__BUMBLEBEE_DIR__/current.ndjson"</string>
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

Substitute `__BUMBLEBEE_DIR__` and `__BUMBLEBEE_BIN__` (the path captured at the end of Phase 1). Then:

```bash
launchctl load ~/Library/LaunchAgents/dev.bumblebee.scan.plist
launchctl list | grep dev.bumblebee.scan
```

This runs every Monday at 09:00 local. `Weekday` 0 is Sunday; adjust to taste.

### Linux — cron

```bash
# crontab -e and add (substitute __BUMBLEBEE_DIR__ and __BUMBLEBEE_BIN__):
0 9 * * 1 OUT="__BUMBLEBEE_DIR__/scan-$(date +\%Y\%m\%d-\%H\%M\%S).ndjson"; "__BUMBLEBEE_BIN__" scan --profile baseline > "$OUT" 2>"${OUT%.ndjson}.stderr" && jq -e 'select(.record_type=="scan_summary" and .status=="ok")' "$OUT" >/dev/null && ln -sf "$(basename "$OUT")" "__BUMBLEBEE_DIR__/current.ndjson"
```

Don't write this without showing the user first — cron entries are easy to forget and accumulate. Print the proposed line and have them confirm before piping it into `crontab -`.

The `&&` chain matters: it ensures the `current.ndjson` symlink is only repointed if the scan exits cleanly *and* the `scan_summary` row reports `status=="ok"`. A scheduled job that crashes mid-walk, or emits `status=="partial"`, leaves the prior good pointer intact instead of clobbering it with a truncated file. Note: if the binary location changes later (`brew upgrade`, rebuild to a different `GOBIN`), the scheduler will exit 127 and the symlink stays put — re-run `/security-bumblebee` to refresh the entries.

### Pruning

NDJSON files are small (KB, not MB) but accumulate. Suggest the user add a quarterly prune:

```bash
# Keep the last 90 days
find "$BUMBLEBEE_DIR" -name 'scan-*.ndjson' -mtime +90 -delete
```

## Phase 5 — (Optional) Wire up an exposure catalog

Without a catalog, scans only emit `package`/`mcp`/`extension` records. With one, scans also emit `finding` records when an `(ecosystem, name, version)` tuple matches.

Bumblebee ships maintained sample catalogs in [`threat_intel/`](https://github.com/perplexityai/bumblebee/tree/main/threat_intel) built from public advisories. To use them:

```bash
CATALOG_DIR="$BUMBLEBEE_DIR/catalogs"
mkdir -p "$CATALOG_DIR"
gh repo clone perplexityai/bumblebee /tmp/bumblebee-source 2>/dev/null || (cd /tmp/bumblebee-source && git pull)
cp /tmp/bumblebee-source/threat_intel/*.json "$CATALOG_DIR/"
```

Then re-run the scan with `--exposure-catalog`:

```bash
bumblebee scan --profile baseline \
  --exposure-catalog "$CATALOG_DIR" \
  --findings-only \
  > "$BUMBLEBEE_DIR/findings-$(date +%Y%m%d-%H%M%S).ndjson"
```

`--findings-only` drops package records and keeps the output small — good for "did anything match?" pings. Don't use it for inventory; use it for advisory response.

## Phase 6 — End-of-session summary

Tell the user:

```
Installed bumblebee. Scan output at: __BUMBLEBEE_DIR__/

First baseline scan: scan-__TS__.ndjson
  __N__ packages across __M__ ecosystems

Recurring scan: __scheduled / not scheduled__
Exposure catalog: __configured / not configured__

Next time an advisory drops, give me the package name + version and I'll
grep the latest scan. Or run /security-bumblebee review to look at the
most recent file together.
```

## Notes

- **Don't scan with `--profile deep` interactively.** It walks bare `$HOME` and takes minutes. Reserve it for explicit on-demand advisory checks with a catalog.
- **Don't emit MCP config `env` values.** Bumblebee already strips these by design — but if you write any scripts that re-parse the configs, do the same.
- **No fleet plumbing.** This skill is for one machine. If the user mentions "deploy this to 50 laptops" or "ship to SIEM", point them at the upstream README's MDM / transport docs and stop — that's a different shape of work.
- **Related skills.** [[security-snyk]] and [[security-socket]] cover the CI / PR-time side. Bumblebee covers the endpoint side. They're complementary, not overlapping.
