# Per-agent config + transcript reference

Each agent stores its allowlist and its session history differently. This
reference captures what's known at the time of writing — but **verify before
writing**, because agents change layouts often.

## Claude Code

**Transcript root**: `~/.claude/projects/<encoded-cwd>/<session-uuid>.jsonl`

The encoded-cwd is the absolute path with `/` replaced by `-` (e.g. cwd
`/Users/alice/proj` → directory `-Users-alice-proj`).

**Settings**:
- Project: `<repo>/.claude/settings.json`
- User: `~/.claude/settings.json`
- Local-only override (gitignored): `<repo>/.claude/settings.local.json`

**Allowlist schema**:
```json
{
  "permissions": {
    "allow": [
      "Bash(git status:*)",
      "Bash(gh pr view:*)",
      "Read",
      "WebFetch(domain:docs.anthropic.com)"
    ],
    "deny": []
  }
}
```

**Pattern rules**:
- `Bash(<prefix>:*)` — the `:*` is a wildcard for any args. `Bash(git status:*)`
  matches `git status`, `git status -s`, `git status --short`, but not
  `git statusfoo`.
- `Bash(<exact>)` — exact match, no args.
- Bare tool name (`Read`, `Edit`, `WebSearch`) — allow that tool entirely.
- `WebFetch(domain:<host>)` — domain-scoped allow.
- `mcp__<server>__<tool>` — MCP tool allow.

**Write rules**:
- JSON, 2-space indent, trailing newline.
- Preserve any keys other than `permissions.allow`.
- Dedupe against existing entries (string equality is sufficient — these
  patterns are canonicalised).
- The `deny` list takes precedence; never propose a pattern that's already
  denied.

## Codex CLI (OpenAI)

**Config**: `~/.codex/config.toml`

**Approval policies** (not per-command allowlists in the Claude Code sense):
```toml
approval_policy = "on-failure"  # or "never" | "untrusted"
sandbox_mode    = "workspace-write"

[projects."/Users/alice/proj"]
trust_level = "trusted"   # project-level skip-approval
```

**Transcript root**: `~/.codex/sessions/<date>/<session>.jsonl` (layout has
changed across versions; double-check).

**Limitations**: Codex's approval model is closer to a global policy + a
project trust list than to per-command allow patterns. The most useful
"fewer prompts" lever is usually:
1. Marking the current project trusted.
2. Switching `approval_policy` from `on-failure` to a less restrictive mode
   *for that project only* (don't change the global default without asking).

If the user asks for per-command tuning, explain Codex doesn't really do it
and offer the project-trust lever instead.

## Cursor

**Settings**: `~/.cursor/settings.json` (user) and workspace `.cursor/` (project).

**Allowlist key**: `cursor.terminal.autoRun.allowList` (an array of shell
glob patterns) and `cursor.terminal.autoRun.denyList`.

Example:
```json
{
  "cursor.terminal.autoRun.allowList": [
    "git status*",
    "gh pr view *",
    "ls *"
  ],
  "cursor.terminal.autoRun.denyList": [
    "rm *",
    "sudo *"
  ]
}
```

**Transcripts**: Cursor doesn't expose session history as plain files in a
predictable location. Skip the transcript scan for Cursor and instead ask the
user what they want auto-allowed, or copy proposals from a Claude Code /
Codex scan.

## Aider

Aider's autonomy is binary (`--yes-always` / interactive) — no per-command
allowlist. Skip.

## Adding a new agent

To support another agent, you need to know:
1. Where its config lives (and whether project vs user scope exists).
2. The schema for whatever "auto-run" / "allowlist" / "trust" concept it has.
3. Where its session transcripts live (and the line shape for tool calls).
4. How its pattern syntax maps from a raw command to a wildcard pattern.

Add a row to the table in `SKILL.md` Step 1 and a section here.
