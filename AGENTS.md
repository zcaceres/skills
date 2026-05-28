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
| Hooks config | `settings.json` `hooks` block, shell commands per event | Scripts registered in Codex config, lifecycle events (turn-stop, prompt-submit, etc.) | JSON config, events include subagent-launch, artifact-create, before-browser-action |
| Hook portability | None | None | None |
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
4. **Hooks are per-agent.** Never assume a hook written for Claude works for
   Codex or Antigravity — the event names, config schema, and execution
   contract differ. If a skill needs hooks on multiple agents, write one per
   agent and document the parity (or gaps) in the skill's README.
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
         command: "${SKILL_DIR}/scripts/run.sh"
   ---
   ```

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

