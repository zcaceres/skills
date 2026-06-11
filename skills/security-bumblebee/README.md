# security-bumblebee

Set up [bumblebee](https://github.com/perplexityai/bumblebee) — Perplexity's
read-only endpoint scanner — on a single developer machine. Built for
individuals and small teams; not MDM / SIEM.

Bumblebee answers a different question than [security-snyk](../security-snyk)
and [security-socket](../security-socket): instead of "is this PR introducing
a known-bad dependency?", it answers "when an advisory drops, do I have the
named package, extension, or MCP server installed on disk right now?"

This skill:

1. Installs the binary via `go install` (or prebuilt release tarball).
2. Picks an OS-appropriate output directory:
   - macOS: `~/Library/Logs/bumblebee/`
   - Linux: `${XDG_STATE_HOME:-$HOME/.local/state}/bumblebee/`
3. Runs a baseline scan, saves the NDJSON, and walks through what it found.
4. Optionally schedules a recurring scan (launchd on macOS, cron on Linux).
5. Optionally clones the upstream `threat_intel/` catalogs so future scans
   flag known-bad versions.

The agent can grep the latest scan file when an advisory lands — no fleet
plumbing, no central service.

## Use

User-triggered only — activates when the user invokes `/security-bumblebee`.

## Install

```sh
npx skills add zcaceres/skills -s security-bumblebee
```
