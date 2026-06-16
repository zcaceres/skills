---
name: cli-agent-friendly-audit
description: Audit a CLI tool against the agent-friendliness checklist from Zbigniew Sobiecki's "Building Agent-Friendly CLIs". Use when the user says "quality-cli-agent-friendly-audit", "cli-agent-friendly-audit", "audit this cli", "is my cli agent-friendly", or asks to check a CLI for agent ergonomics.
---

# quality-cli-agent-friendly-audit

Walk through a checklist of properties that make a CLI smooth for AI agents to use. Based on Zbigniew Sobiecki's "Building Agent-Friendly CLIs" (https://zbigniew.me/writing/building-agent-friendly-clis/).

## How to run

1. Ask the user which CLI to audit (binary name, repo path, or command to invoke). If they've already named one, skip the question.
2. Probe the CLI where possible — run `<cli> --help`, `<cli> <subcommand> --help`, try `--json`, try a deliberately wrong flag, try a typo, inspect exit codes with `echo $?`. Don't run anything destructive.
3. Walk the checklist below in order. For each item, record one of: **Pass**, **Fail**, **Partial**, **N/A**, **Unknown** (couldn't verify without source/more probing). Include a one-line note with the evidence or the specific fix.
4. At the end, print a short summary: top 3 fixes ranked by impact on agent token/latency cost.

Keep the audit terse. One line per item is usually enough. Don't lecture — the user knows what good looks like.

## The checklist

### Discovery
- [ ] `--help` and `-h` both work at every level (root, subcommand, sub-subcommand).
- [ ] Help output is in sync with the actual code (spot-check one flag).
- [ ] Help is token-efficient — no ASCII art, no walls of prose, high signal-to-noise.
- [ ] Progressive discovery: root help lists entities, entity help lists actions, action help lists flags.

### Command shape
- [ ] Consistent noun-verb (or verb-noun) shape across all commands.
- [ ] Same concept uses the same flag name everywhere (`--project` vs `--projectId` vs `--project-name` is a fail).
- [ ] Pluralization, aliases, and naming are predictable.
- [ ] Cross-cutting orientation commands exist: `search`, `get <id>`, `whoami`, `recent`, or equivalent.

### Auth (if remote)
- [ ] Non-interactive once the human has logged in once.
- [ ] Documented credential resolution order (flag → env → config file → OS keychain → defaults).
- [ ] `whoami` (or equivalent) shows which credential is actually in use.
- [ ] No biometric/OS prompts on every invocation.

### Structured output
- [ ] `--json` flag available on every read/list/mutation command.
- [ ] JSON shape is documented (in `--help` or skills).
- [ ] Optional env var (e.g. `<CLI>_OUTPUT_MODE=json`) so agents don't have to remember the flag.
- [ ] Field projection supported (`--json id,title,status`) — bonus.

### Pagination
- [ ] List commands have a documented default page size.
- [ ] A machine-readable signal indicates more results exist (`meta.nextCursor` or `meta.truncated`).
- [ ] Cursor-based pagination (not offset) — stable under concurrent writes.
- [ ] `--all` flag drains every page.

### Stream hygiene
- [ ] stdout carries data only. stderr carries progress, warnings, debug.
- [ ] `--json` output on stdout is pure JSON — no "Loading..." line, no spinner, no warnings prefixed.
- [ ] Long-running commands stream output progressively (NDJSON for structured streams) — no buffering until exit.

### Terminal control
- [ ] No ANSI colors / control sequences when stdout is not a TTY.
- [ ] Respects `NO_COLOR=1` and `CI=true`.
- [ ] `--no-color` flag exists for forced override.
- [ ] No mandatory TUI — every TUI feature also reachable via plain commands.

### Mutations return enough
- [ ] Create/update/delete return the resulting object (or at least stable ID, URL, status, timestamps).
- [ ] No "Task created." with no ID — that forces a lookup.
- [ ] Retries are safe (agent can detect "this already happened" from the returned object).

### Identifiers
- [ ] Stable IDs in all output (not just human names).
- [ ] If minted internally: short, speakable, type-prefixed IDs (e.g. `T-7K9-C`) layered over UUIDs.
- [ ] Local validation possible (checksum / unambiguous alphabet like Crockford Base32). Bonus — skip if the CLI wraps a service that hands you UUIDs.

### Large inputs
- [ ] Body-like flags accept a file path (`--file <path>` or `@path` prefix) — no shell-quoting hell for multi-line content.

### Exit codes
- [ ] `0` = success, non-zero = failure. Always.
- [ ] Small stable taxonomy of non-zero codes (e.g. user error / usage error / auth / network).
- [ ] Codes are documented somewhere the agent can find them.
- [ ] Signal-terminated processes use `128 + n` convention.

### Errors
- [ ] Typo'd commands/flags get a fuzzy-matched suggestion.
- [ ] Domain object typos suggest close matches ("did you mean Website?").
- [ ] Usage errors show the relevant local usage inline — agent doesn't need a second `--help`.
- [ ] Error messages name the next correct action.

### Interactive prompts
- [ ] Auto-detects non-interactive context (stdin not a TTY, `CI=true`, no terminal width).
- [ ] In non-interactive mode: fails fast with a clear message, OR proceeds with safe defaults.
- [ ] Destructive ops require explicit flags (`--yes`, `--force`, `--non-interactive`) — never block on a prompt.
- [ ] No arrow-key menus / multi-selects as the only path to a feature.

### Agent skill / docs
- [ ] An agent-facing skill (or equivalent quickstart) exists with workflows, output shapes, jq snippets, footguns.
- [ ] Skill is versioned alongside the CLI to prevent drift.

## Output format

Render the audit as a markdown table with three columns: **Item**, **Status**, **Note**. Group by section. At the end add:

```
## Top fixes (ranked by agent-impact)
1. ...
2. ...
3. ...
```

Bias the ranking toward fixes that compound across thousands of invocations — stream hygiene, JSON purity, exit code taxonomy, and mutations returning enough info usually beat cosmetic polish.
