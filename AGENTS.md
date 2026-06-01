# AGENTS.md

Cross-agent authoring notes for this repo. Skills here target three CLIs —
**Claude Code**, **Codex CLI** (OpenAI), and **Antigravity CLI** (Google).
All three converged on a `SKILL.md` directory standard, but the surrounding
conventions (paths, hooks, instruction files, distribution) differ. Use this
file as a checklist whenever adding or modifying a variant.

## The shared core

A skill is a directory containing `SKILL.md` with YAML frontmatter:

```yaml
---
name: kebab-case-name
description: One-line summary used by the agent to decide relevance.
---
```

Optional siblings: `scripts/`, `examples/`, `resources/`, `references/`.
Keep `SKILL.md` itself short — the agent only loads the body when the
description matches the task.

## Per-agent differences

| Concern | Claude Code | Codex CLI | Antigravity CLI |
|---|---|---|---|
| Skill install path (user) | `~/.claude/skills/<name>/` | `~/.codex/skills/<name>/` | `~/.antigravity/skills/<name>/` |
| Skill install path (project) | `.claude/skills/<name>/` | `.codex/skills/<name>/` | `.agents/skills/<name>/` (legacy: `.agent/skills/`) |
| Instruction file | `CLAUDE.md` (hierarchical) | `AGENTS.md` (+ `AGENTS.override.md`) | `AGENTS.md` |
| Slash commands | `~/.claude/commands/*.md` | `~/.codex/prompts/*.md` (**deprecated** — use skills) | Plugin commands |
| Hooks config | `~/.claude/settings.json` `hooks` block, **or** `hooks:` in SKILL.md frontmatter (auto-wired on skill load). Events: `PreToolUse`, `PostToolUse`, `UserPromptSubmit`, `Stop`, `SubagentStop`, `Notification`, `SessionStart`, `SessionEnd`, `PreCompact`. | `~/.codex/hooks.json` or `~/.codex/config.toml` `[hooks]` table (also project `.codex/` and plugin-bundled). Events match Claude almost 1:1: `PreToolUse`, `PostToolUse`, `UserPromptSubmit`, `Stop`, `SubagentStart`, `SubagentStop`, `SessionStart`, `PermissionRequest`, `PreCompact`, `PostCompact`. **No `hooks:` block in SKILL.md frontmatter** — distribute as a plugin with bundled `hooks/hooks.json`, or have the user paste a snippet. | **No hook system.** Google staff confirmed on the official forum ([discuss.ai.google.dev/t/120458](https://discuss.ai.google.dev/t/hooks-in-antigravity/120458)). Rules (`.agent/rules/*.md`) and workflows (`.agent/workflows/*.md`) are advisory only — model-obedience-grade, not enforcement. |
| Hook portability | Claude↔Codex events overlap heavily; the same `PreToolUse: Bash` shape ports with config-format translation (YAML/JSON ↔ TOML/JSON). | Same — Codex's `permissionDecision: "deny"` JSON and Claude's exit-2+stderr are interchangeable. | None — guard-style skills cannot port. |
| Subagents | Yes, first-class | Via skills + scripts | Yes, first-class |
| Plugin/extension distribution | Plugin marketplace | Skills are the unit | Antigravity plugins (successor to Gemini CLI extensions) |

## Authoring rules for this repo

1. **Default to a Claude variant.** Every skill must have `claude/SKILL.md`.
   Add `codex/` or `antigravity/` only when the skill is actually useful in
   that agent *and* the framing differs enough to need its own file.
2. **Update `package.json` `skill.agents` and `skill.entry`** whenever you
   add or remove a variant. `scripts/check-skills.ts` enforces this.
3. **Put shared prose / binaries in `shared/`.** Variants reference them via
   relative path or `{{ include "shared/foo.md" }}` at build time. Do not
   duplicate prose across variant folders.
4. **Hooks are per-agent, but Claude↔Codex overlap is real.** Event names
   are nearly identical between Claude Code and Codex CLI (`PreToolUse`,
   `PostToolUse`, `Stop`, `UserPromptSubmit`, …), so a hook script written
   for one usually ports to the other with only the config wrapper changing
   (settings.json YAML vs `~/.codex/hooks.json` / `config.toml`). The
   binary's stdin contract is the same JSON payload, and Claude's exit-2 +
   stderr message is interchangeable with Codex's
   `{ "hookSpecificOutput": { "permissionDecision": "deny" } }`.
   Antigravity has no hook system at all — guards degrade to advisory
   rules. See the **Hooks across agents** section for full detail.
5. **Frontmatter `description`** is the routing signal for all three agents.
   Lead with concrete trigger phrases ("Use when user says..."). Keep under
   ~200 chars.
6. **Paths in skill bodies** should be relative to the skill directory, not
   absolute or agent-specific. The installer rewrites locations on install.
7. **Slash commands**: don't author new ones for Codex — they're deprecated
   there. Use a skill instead. For Claude/Antigravity, slash commands live
   outside this repo's skill format; if a skill ships one, document it in
   the variant's README.
8. **AGENTS.md vs CLAUDE.md**: Codex and Antigravity both read `AGENTS.md`;
   Claude reads `CLAUDE.md`. If a skill needs to drop instructions into a
   consuming project, ship the right filename per variant.

## Hooks across agents

This repo's "guard" skills (`rm-rf-guard`, `git-reset-guard`) are the canonical
hook-style shape. The contract is:

1. A bundled binary reads a JSON payload on stdin (`tool_input.command`).
2. Match against blocked patterns.
3. On match: exit 2 with a stderr message → agent blocks the tool call.
4. Otherwise: exit 0.

Three agents, three different wiring stories — verified against current docs
and source as of 2026-05.

### Claude Code (supported, with one footgun)

Two wiring paths. Both produce the same runtime behavior.

**(a) SKILL.md frontmatter — auto-wired on skill load:**
```yaml
hooks:
  PreToolUse:
    - matcher: Bash
      hooks:
        - type: command
          command: "~/.claude/skills/rm-rf-guard/scripts/run.sh"
          timeout: 30
```

**(b) `~/.claude/settings.json` — explicit, always works:**
```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash",
        "hooks": [{ "type": "command", "command": "<absolute>/run.sh" }] }
    ]
  }
}
```

⚠️ **`${CLAUDE_SKILL_DIR}` is not substituted in frontmatter `command` strings.**
Tracked in [anthropics/claude-code#36135](https://github.com/anthropics/claude-code/issues/36135),
closed NOT PLANNED, stale-bot-closed 2026-05-04. The literal string is passed to
the shell and expands to empty, so the hook tries to exec `/scripts/run.sh` and
fails. Workarounds:
- Use a tilde-expanded absolute path in frontmatter: `"~/.claude/skills/<name>/scripts/run.sh"` (portable across users, brittle if install location changes).
- Or skip frontmatter and have the user paste the snippet into `settings.json` with a hardcoded absolute path. Our published SKILL.md leads with this.

### Codex CLI (supported, ship as plugin)

Codex's hook engine landed with Claude-compatible events. The biggest
difference is **distribution surface**: Codex skills' frontmatter does *not*
read a `hooks:` block. Three valid carriers:

1. **User config** — `~/.codex/hooks.json` or `~/.codex/config.toml`:
   ```toml
   [[hooks.PreToolUse]]
   matcher = "^Bash$"
   [[hooks.PreToolUse.hooks]]
   type = "command"
   command = "/abs/path/to/run.sh"
   timeout = 30
   ```
2. **Project config** — `<repo>/.codex/hooks.json`.
3. **Plugin-bundled** — ship the guard as a Codex plugin with
   `hooks/hooks.json` and `requirements.toml`. Inside a plugin, `$PLUGIN_ROOT`
   resolves to the unpacked plugin directory (the Codex analog of
   `${CLAUDE_SKILL_DIR}`). Plugin hooks are auto-trusted; user-config hooks
   require explicit `/hooks` trust.

**Deny signal:** either exit 2 with stderr (Claude-compatible) or print
```json
{ "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "blocked by guard"
}}
```

**Known gap:** PreToolUse "doesn't intercept all shell calls yet — only the
simple ones" (newer `unified_exec` streaming path has incomplete coverage).
Best-effort, not airtight. Document it on the skill README before flipping
`crossAgent.supports` to include `"codex"`.

### Antigravity CLI (not supported)

There is no hook system. Google staff stated this directly on the official
forum ([discuss.ai.google.dev/t/120458](https://discuss.ai.google.dev/t/hooks-in-antigravity/120458)).
The closest primitives are:
- **Rules** — `.agent/rules/*.md` with `always_on: true` frontmatter. Soft
  guidance the model is asked to follow. Independent testing puts compliance
  around 60% — not enforcement.
- **Workflows** — `.agent/workflows/*.md` triggered by slash command. Steps
  prefixed `// turbo` *skip* approval (opposite of a guard).

`subagent-launch`, `artifact-create`, `before-browser-action` — names that
have appeared in this repo's docs and elsewhere — **do not exist** in any
authoritative Antigravity source. They appear to be conflated with another
product.

**Implication:** `rm-rf-guard` / `git-reset-guard` cannot be ported to
Antigravity as enforcement. If a user needs hard blocks under Antigravity,
the only paths are (a) external shell sandboxing or (b) keep the guard on
Claude / Codex only. Document the gap in the skill README; don't pretend
otherwise in `crossAgent.supports`.

### Practical rules for hook-style skills in this repo

1. **Default `crossAgent.supports`** for a guard is `["claude", "codex"]`.
   Antigravity is out — list it in the README "Not supported" section.
2. **Ship two install snippets** in the skill README — one for Claude
   (`~/.claude/settings.json`) and one for Codex (`~/.codex/hooks.json` or
   `config.toml`). Keep them identical in spirit so the user copies once.
3. **Stdin payload shape** is the JSON `{ tool_input: { command: "…" } }`.
   The same binary serves both agents — no per-agent build needed beyond
   the OS launcher (`run.sh` / `run.cmd`).
4. **Plugin-vs-bare distribution.** A bare skill install (file copy into
   `~/.claude/skills/` or `~/.codex/skills/`) installs the binary but does
   **not** auto-wire either settings file. Today the user pastes the snippet.
   Auto-wiring is open work — see kanban card "hooks: ship optional
   install.sh that wires settings.json automatically".

## Kanban / task tracking

Work for this repo is tracked as draft issues in GitHub Project **`skills`**
(owner: `zcaceres`, project number `4`, ID `PVT_kwHOAJkXU84BZADT`).
View: https://github.com/users/zcaceres/projects/4

Add a card:
```sh
gh project item-create 4 --owner zcaceres --title "<short title>" [--body "<details>"]
```

List cards:
```sh
gh project item-list 4 --owner zcaceres --limit 50
```

Titles are short topic labels (e.g. `stacked-prs`, `zoom in zoom out`) — put
detail in the body, not the title.

## When adding a new agent target

1. Add a folder `skills/<name>/<agent>/` with `SKILL.md`.
2. Extend `skill.agents` and `skill.entry` in `package.json`.
3. Update `_template/` if the new agent should be scaffolded by default.
4. Note any hook / command / path quirks in this file's table above.

## Porting a Claude hook from a sibling repo

When porting a single-file Bash-PreToolUse hook (e.g. `claude-rm-rf`,
`claude-git-reset`) into this monorepo, the conversion is mechanical.
Use `rm-rf-guard` as the reference shape:

1. **Scaffold.** From the repo root:
   ```sh
   bun run new <name> "<one-line description, ≤ 200 chars>"
   ```
   The new skill lives at `skills/<name>/`.

2. **Drop in the hook source.** Copy verbatim from the upstream repo:
   ```sh
   cp ../claude-<x>/src/index.ts        skills/<name>/scripts/index.ts
   cp -r ../claude-<x>/tests            skills/<name>/tests
   ```
   In the test file, retarget the hook path:
   ```sh
   sed -i '' 's|"src", "index.ts"|"scripts", "index.ts"|' \
     skills/<name>/tests/*.test.ts
   ```
   (Drop the `''` on Linux.)

3. **Add the OS launcher.** Copy the launcher pair from `rm-rf-guard`,
   then substitute the binary basename:
   ```sh
   cp skills/rm-rf-guard/scripts/run.sh  skills/<name>/scripts/run.sh
   cp skills/rm-rf-guard/scripts/run.cmd skills/<name>/scripts/run.cmd
   sed -i '' 's/rm-rf-guard/<name>/g' skills/<name>/scripts/run.{sh,cmd}
   ```

4. **Patch `package.json`.** Add the cross-compile scripts, the
   `fetch-tools` indirection, and the `crossAgent` declaration. Easiest
   is to copy the keys from `skills/rm-rf-guard/package.json` and
   `sed`-replace the basename:
   ```jsonc
   {
     "scripts": {
       "build:linux":   "bun build scripts/index.ts --compile --target=bun-linux-x64    --outfile scripts/bin/<name>-linux-x64",
       "build:macos":   "bun build scripts/index.ts --compile --target=bun-darwin-arm64 --outfile scripts/bin/<name>-darwin-arm64",
       "build:windows": "bun build scripts/index.ts --compile --target=bun-windows-x64  --outfile scripts/bin/<name>-windows-x64.exe",
       "build:all":     "bun run build:linux && bun run build:macos && bun run build:windows",
       "fetch-tools":   "bun run build:all"
     },
     "crossAgent": {
       "supports": ["claude"],
       "requires": ["name", "description", "hooks"]
     }
   }
   ```
   Only widen `supports` past `["claude"]` if the skill actually works
   without the `hooks` frontmatter — Codex and Antigravity don't read
   it, so any hook-driven skill is Claude-only by definition.

5. **Write `SKILL.md` frontmatter** with the `hooks:` block:
   ```yaml
   ---
   name: <name>
   description: <one-liner, lead with verb + concrete trigger phrases>
   hooks:
     PreToolUse:
       - matcher: Bash
         type: command
         command: "${CLAUDE_SKILL_DIR}/scripts/run.sh"
   ---
   ```

   ⚠️ `${CLAUDE_SKILL_DIR}` is not substituted in frontmatter `command`
   strings — [anthropics/claude-code#36135](https://github.com/anthropics/claude-code/issues/36135),
   closed NOT PLANNED (stale-bot 2026-05-04). Use a tilde-expanded absolute
   path (`"~/.claude/skills/<name>/scripts/run.sh"`) in frontmatter, or lead
   the skill's `## Install` section with the manual `.claude/settings.json`
   snippet. See the **Hooks across agents** section above for the full picture
   and the Codex / Antigravity story.

6. **Verify before opening a PR.** Five greens:
   ```sh
   bun install                          # link workspace
   bun test --cwd skills/<name>         # behavior preserved from upstream
   bun run check                        # frontmatter sanity
   bun run cross-agent <name>           # parity claim is honest
   bun run build:all --cwd skills/<name>  # binaries land in scripts/bin/
   bun run build <name>                 # publishable tree in dist/<name>/
   ```
   And a live smoke test:
   ```sh
   printf '{"tool_input":{"command":"<thing-that-should-block>"}}' \
     | skills/<name>/scripts/run.sh
   # exit 2 + BLOCKED message on stderr → working
   ```

If any step is sticky, the freshest reference port is the most recent
`feat: port …` commit — diff it against the upstream repo to see
exactly what changed and what stayed verbatim.

