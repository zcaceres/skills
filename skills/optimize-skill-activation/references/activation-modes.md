# Skill activation modes — the exact shapes

Each mode is a different combination of frontmatter and (optionally) hooks.
This file is the per-mode cheat sheet the parent `SKILL.md` points at. Verify
against current Claude Code docs before writing — the schema changes.

## 1. Slash-only

**Goal:** keep the metadata (name + description) in the system prompt so the
user discovers the skill, but block the model from auto-invoking it. The body
only loads when the user explicitly types `/skill-name`.

**Frontmatter shape:**

```yaml
---
name: my-skill
description: ...
disable-model-invocation: true
---
```

**When this is right:**

- Destructive or expensive workflows (deploy, publish, rm, payments).
- Skills the user always invokes by slash anyway — measured from transcripts.
- Skills whose description would otherwise over-trigger (broad nouns like
  "code", "files", "review").

**Failure modes:**

- The skill becomes invisible to other agents (`SlashCommand` tool can't
  call it). If the user has agents that depend on programmatic invocation,
  this will silently break them.
- The user has to remember the slash. If they don't, the skill effectively
  doesn't exist.

**Pattern:** add the single line `disable-model-invocation: true` to the
frontmatter. Preserve every other key. 2-space YAML indent, trailing newline.

## 2. Model-invocable (default)

**Goal:** name + description in the system prompt; the model decides when to
load the body based on user input.

**Frontmatter shape:** no special field — just `name` and `description`.

```yaml
---
name: my-skill
description: Use when the user says "exact phrase 1", "exact phrase 2", or "/my-skill".
---
```

**When this is right:**

- The description has specific trigger phrases that won't false-positive on
  unrelated conversation.
- The skill is idempotent or read-only enough that an accidental invocation
  is cheap.
- The user invocation pattern is mixed — sometimes slash, sometimes natural
  language.

**Failure modes:**

- A weak description ("helps with code") burns metadata budget for a skill
  the model never picks. Tighten descriptions — name the *exact* phrases
  users say.
- An overly broad description over-triggers, loading the body on turns where
  the user didn't want it.

**Pattern:** if a skill currently has `disable-model-invocation: true` and
should switch to default, *remove the line entirely* — don't set it to
`false`. The absence is the documented default.

## 3. Eager-loaded (SessionStart hook)

**Goal:** inject the SKILL.md body into every session at startup, so it's
already in context before the first user message — no trigger needed.

**Frontmatter shape:**

Claude Code does **not** expose a `CLAUDE_SKILL_DIR` env var to hooks. The
documented variables are `CLAUDE_PROJECT_DIR`, `CLAUDE_PLUGIN_ROOT`,
`CLAUDE_PLUGIN_DATA`, `CLAUDE_ENV_FILE`, `CLAUDE_EFFORT`, `CLAUDE_CODE_REMOTE`.
Pick the right `command:` shape based on where the skill lives:

*Project-scoped skill* (`<repo>/.claude/skills/my-skill/`):

```yaml
---
name: my-skill
description: ...
hooks:
  SessionStart:
    - matcher: "*"
      type: command
      command: "${CLAUDE_PROJECT_DIR}/.claude/skills/my-skill/scripts/inject-context.sh"
---
```

*User-scoped skill* (`~/.claude/skills/my-skill/`): no env var points here, so
bake the absolute path. The installer step in the parent
`optimize-skill-activation` skill is responsible for writing the resolved path
into this field at install time:

```yaml
---
name: my-skill
description: ...
hooks:
  SessionStart:
    - matcher: "*"
      type: command
      command: "$HOME/.claude/skills/my-skill/scripts/inject-context.sh"
---
```

`$HOME` is inherited by the hook process, so it expands in the shell Claude
Code spawns to run the command.

**Companion script** (`scripts/inject-context.sh`) — self-resolving so it works
regardless of install scope:

```bash
#!/usr/bin/env bash
# Print the SKILL.md body (without frontmatter) so Claude Code injects it
# into the session at startup.
set -euo pipefail
SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SKILL_MD="$SKILL_DIR/SKILL.md"
# Strip the leading YAML frontmatter block (between the first two `---` lines).
awk 'BEGIN{f=0} /^---$/{f++; next} f>=2{print}' "$SKILL_MD"
```

Make it executable: `chmod +x scripts/inject-context.sh`.

**When this is right:**

- Always-relevant guidance (coding standards, repo conventions, commit-message
  format) the model should honor on every turn.
- Body is short (a few hundred words). Eager-loading a 5k-word body wastes
  the budget you're trying to save.
- The skill currently auto-activates on most turns anyway — paying once at
  startup beats paying per activation.

**Failure modes:**

- **Token bloat.** Eager loading is *strictly more expensive* than default
  mode for skills that don't fire on most turns. Only switch when the
  measured auto-invocation rate is high.
- **Hook noise.** Every session pays the cost of running the script. Keep
  the script trivial.
- **Confusion with `PreToolUse` hooks.** Some skills already use a
  `PreToolUse` hook for safety (rm-rf guard, dotenv guard). Don't conflate —
  those are blocking interceptors, not context injection. A skill can have
  both kinds of hook simultaneously.

**Pattern:** append (don't overwrite) a `hooks:` block. If the skill already
has a `hooks:` block (e.g. a `PreToolUse` entry), add the `SessionStart`
entry alongside it — don't replace.

## Reverting

Every mode change is reversible by restoring the `.bak.<timestamp>` copy of
SKILL.md the parent skill creates before editing. If the eager-load mode
dropped an `inject-context.sh`, delete it too on revert.

## Quick reference: which mode for which skill?

| Skill archetype                                  | Recommended mode    |
|--------------------------------------------------|---------------------|
| `/pr`, `/decompose`, `/acid-trip`        | Slash-only          |
| Destructive: deploy, publish, payments           | Slash-only          |
| `optimize-permissions`, `review-code`            | Model-invocable     |
| Read-only audits with clear trigger phrases      | Model-invocable     |
| Repo conventions, commit-message rules           | Eager-loaded        |
| PR-template enforcement, license headers         | Eager-loaded        |
| Safety guards (rm-rf, dotenv)                    | `PreToolUse` hook (orthogonal — not in this skill's scope) |
