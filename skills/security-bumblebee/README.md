# security-bumblebee

Set up [bumblebee](https://github.com/perplexityai/bumblebee) — Perplexity's
read-only endpoint scanner — on a single developer machine. Built for
individuals and small teams; not MDM / SIEM.

Bumblebee answers a different question than [security-snyk](../security-snyk)
and [security-socket](../security-socket): instead of "is this PR introducing
a known-bad dependency?", it answers "when an advisory drops, do I have the
named package, extension, or MCP server installed on disk right now?"

Two modes:

**Setup mode** (once, on a new machine):

1. Installs the binary via `go install` (or prebuilt release tarball).
2. Picks an OS-appropriate output directory:
   - macOS: `~/Library/Logs/bumblebee/`
   - Linux: `${XDG_STATE_HOME:-$HOME/.local/state}/bumblebee/`
3. Runs a baseline scan, saves the NDJSON, and walks through what it found.
4. Optionally schedules a recurring scan (launchd on macOS, cron on Linux).
5. Optionally fetches the upstream `threat_intel/` catalogs so future scans
   flag known-bad versions.

**Review mode** (every time after):

- Reads the latest scan from `current.ndjson`.
- Surfaces what's new since the prior scan (drift).
- Answers `did I have package X@Y installed?` against the latest data.
- Optionally re-runs the catalog-augmented scan when an advisory drops.

The agent can grep the latest scan file when an advisory lands — no fleet
plumbing, no central service.

## Use

User-triggered only. Invocations:

- `/security-bumblebee` — picks mode automatically (review if a baseline
  exists, setup otherwise).
- `/security-bumblebee setup` — force install/baseline flow.
- `/security-bumblebee review` — summarize the latest scan and drift since
  the prior one.
- `/security-bumblebee check <package>` — direct advisory lookup against
  the latest scan.
- `/security-bumblebee rescan` — re-run the catalog scan against fresh
  data.

## Install

```sh
npx skills add zcaceres/skills -s security-bumblebee
```
