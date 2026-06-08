---
name: optimize-skill-activation
description: Audit installed skills and right-size each one's activation mode — slash-only, model-invocable (name+description in context), or eager-loaded (full body up front). Preview changes, then rewrite each SKILL.md frontmatter. Use when the user says "optimize skills", "right-size skills", "reduce skill tokens", "audit skill activation", or "/optimize-skill-activation".
---

# optimize-skill-activation

Most of the context budget skills cost is paid up front — every installed skill's
`name` + `description` lives in the system prompt of every session. Skills that
should only fire on explicit user intent shouldn't burn that budget; skills the
agent must honor on every turn shouldn't be hidden behind a `/slash` no one
remembers to type. This skill audits what's installed, classifies each skill by
how it's actually used, and rewrites the frontmatter to match.

Inspired by `optimize-permissions` — same UX, same preview-then-confirm shape.

## Mental model

Claude Code skills load in three tiers (progressive disclosure):

1. **Metadata** — `name` + `description` always pinned in the system prompt
   (~100 words per skill). The cheap tier.
2. **SKILL.md body** — loaded only when the skill activates (~thousands of
   words). The expensive tier — paid per activation.
3. **Bundled resources** — `references/`, `scripts/` loaded on demand inside
   the activated skill's flow. Effectively free until used.

There are three knobs that change *when* tier 2 fires:

| Mode               | Frontmatter / hook                               | Tier-1 cost | Tier-2 trigger              |
|--------------------|--------------------------------------------------|-------------|-----------------------------|
| Slash-only         | `disable-model-invocation: true`                 | name+desc   | user types `/skill-name`    |
| Model-invocable    | *(default)*                                      | name+desc   | model decides from context  |
| Eager-loaded       | `SessionStart` hook injecting SKILL.md body      | full body   | always; no trigger needed   |

Mapping skills to the right mode is a judgment call about three things:
*intent strength* (is the user's request always unambiguous?), *blast radius*
(what happens if the model invokes it wrongly?), and *always-relevant*
(should it shape every turn, or only when invoked?).

## When to run

Trigger phrases: *optimize skills*, *right-size skills*, *reduce skill tokens*,
*audit skill activation*, *which skills should be slash-only*,
*which skills should always load*, or `/optimize-skill-activation`.

If the user has fewer than ~3 skills installed, say so and stop — there's
nothing meaningful to optimize.

## Step 1 — detect skill installation roots

Probe in order; record every root that contains skills:

| Scope     | Path                                          | Notes                                                |
|-----------|-----------------------------------------------|------------------------------------------------------|
| User      | `~/.claude/skills/*/SKILL.md`                 | applies to every project                             |
| Project   | `<repo>/.claude/skills/*/SKILL.md`            | project-local; usually checked into git              |
| Plugin    | `~/.claude/plugins/*/skills/*/SKILL.md`       | shipped via plugins; do NOT rewrite — read-only      |

```bash
find ~/.claude/skills -maxdepth 2 -name SKILL.md 2>/dev/null
find .claude/skills -maxdepth 2 -name SKILL.md 2>/dev/null
```

Skip plugin-managed skills — they're owned by their plugin and will be
overwritten on update. Surface them in the report as "managed by `<plugin>`,
not editable here" so the user knows why they're excluded.

If both user and project scopes have skills, ask which to audit (multiSelect is
fine). If only one has skills, target it silently.

## Step 2 — parse each SKILL.md

For each `SKILL.md`, extract:

- `name` (frontmatter)
- `description` (frontmatter)
- `disable-model-invocation` (frontmatter; default `false`)
- `hooks:` (frontmatter — note `SessionStart`, `PreToolUse`, etc.)
- Body word count (proxy for tier-2 cost)
- Whether the body references `/$name` as a usage example (signal of slash-intent)

A thin parser is fine — frontmatter is YAML between `---` fences.

## Step 3 — measure how each skill is actually invoked

Read the most recent ~20 Claude Code transcripts from
`~/.claude/projects/<encoded-cwd>/*.jsonl` (and widen to all projects if the
user says "across everything"). For each skill, count:

- `slash` — user explicitly typed `/skill-name`
- `auto` — model invoked via the Skill tool without an explicit slash
- `never` — installed but never used in the sample

A skill that's *only ever* invoked via slash is a strong candidate for
slash-only mode. A skill that's *only ever* invoked by the model is a candidate
for model-invocable. A skill that fires on nearly every session is a candidate
for eager loading. A skill that's never used is a candidate for removal — flag
it, don't auto-uninstall.

`scripts/scan-invocations.sh` is a thin grep helper; parsing inline is usually
fast enough.

## Step 4 — classify each skill

Combine signals from Steps 2–3 with the heuristics below.

### Recommend slash-only (`disable-model-invocation: true`)

- **Destructive or expensive workflows** — anything that pushes, deletes,
  publishes, sends, charges, or kicks off long-running compute. The user
  should always be the one to start it.
- **Strongly user-intent gated** — `/checkpoint`, `/decompose`, `/acid-trip`,
  `/zoom`, `/roast`. The whole point is the user explicitly asking for it.
- **Workflows whose description would over-trigger** — if the description
  contains broad nouns like "code", "files", "review" the model will pull it
  in too often.
- **Niche / rarely used** — installed but invoked <=1x in the transcript
  sample, *and* always via slash.

### Recommend model-invocable (default — no special frontmatter)

- **Clear, specific trigger phrases in the description** — "use when the user
  says X, Y, or Z" with phrases no other skill would match.
- **Idempotent, read-only, or contained** — running it accidentally costs at
  most a few tool calls; doesn't mutate shared state.
- **Mixed invocation pattern** — sometimes the user remembers the slash,
  sometimes the model picks it up. Default mode supports both.

### Recommend eager-loaded (`SessionStart` hook -> inject SKILL.md body)

- **Always-relevant constraints** — coding standards, repo conventions, a
  custom commit-message format, an opinionated PR template.
- **Tiny body** — a few hundred words at most. Eager-loading a 5k-word skill
  wastes the budget you're trying to save.
- **Frequent re-activation** — if the model invokes it on most turns anyway,
  paying once at session start beats paying per activation.

See `references/activation-modes.md` for the exact frontmatter / hook shapes
and the failure modes of each.

### Recommend removal / archive (flag only — don't auto-delete)

- **Never invoked across all sampled transcripts** *and* installed >30 days.
- **Deprecated** — body opens with "Deprecated — use X instead."
- **Duplicate** — name + description nearly identical to another installed
  skill (common after migrating skills between repos).

Removal is destructive and irreversible. Always require explicit user
confirmation per-skill; never bundle removals into the auto-apply pass.

## Step 5 — preview and confirm

Render a clean preview before writing. Group by recommended action, show the
current -> proposed mode, and a one-line "seen N times via X" rationale:

```
Proposed skill activation changes (~/.claude/skills/)

-> Make slash-only:
  ~ checkpoint           default -> disable-model-invocation: true
                         seen 12x — always via slash, never auto
  ~ acid-trip            default -> disable-model-invocation: true
                         destructive: writes files; intent-gated

-> Make eager-loaded (SessionStart hook):
  ~ commit-style         default -> +SessionStart hook
                         seen 18x across 14 sessions; body is 240 words

-> Leave as-is (model-invocable, well-tuned):
  = optimize-permissions
  = review-code

? Flag for removal (you'll confirm each):
  ? old-prototype-skill  never invoked in 20 sessions; installed 90 days ago
```

Use **AskUserQuestion** with `multiSelect: true` for the final cut. Default
the "leave as-is" group already-applied (no checkbox needed); default the
"slash-only" and "eager-loaded" tiers checked; default "flag for removal"
unchecked. Always offer "edit list manually" as an escape hatch.

If a skill currently has `disable-model-invocation: true` and the
recommendation is "leave as-is", silently skip it from the preview to keep
the noise down.

## Step 6 — write the changes

For each accepted recommendation:

1. **Back up the SKILL.md** before editing:
   ```bash
   cp <path>/SKILL.md <path>/SKILL.md.bak.$(date +%s)
   ```
2. **Slash-only**: add `disable-model-invocation: true` to the frontmatter
   YAML block. If a hook is set up that depends on auto-invocation, warn —
   don't silently break it.
3. **Eager-loaded**: append (don't replace) a `hooks:` block to the
   frontmatter with a `SessionStart` entry, *and* drop a
   `scripts/inject-context.sh` that `cat`s `SKILL.md` (minus frontmatter)
   to stdout — that's what Claude Code reads. For project-scoped skills use
   `${CLAUDE_PROJECT_DIR}/.claude/skills/<name>/scripts/inject-context.sh`;
   for user-scoped skills resolve and write the absolute path (e.g.
   `$HOME/.claude/skills/<name>/scripts/inject-context.sh`) — there is no
   `CLAUDE_SKILL_DIR` env var. See `references/activation-modes.md` for the
   exact shapes.
4. **Removal**: only after a second confirmation; `rm -rf` the skill
   directory, and remove the workspace entry if the user's setup uses
   bun/npm workspaces.
5. **Preserve every other frontmatter key untouched.** YAML indent: 2 spaces.

Never edit plugin-managed skills (Step 1 already excluded them, but
double-check before writing).

## Step 7 — report

Print the final diff (per-skill: current mode -> new mode, backup path). Tell
the user how to revert (restore the `.bak.<ts>` file). Don't re-summarize the
preview — keep it terse.

If the user has multiple Claude Code projects, mention that user-scoped
changes apply everywhere; project-scoped changes apply only here.

## Safety rails

- **Never** rewrite a SKILL.md the user didn't confirm — per-skill consent,
  not blanket.
- **Never** edit plugin-managed skills under `~/.claude/plugins/`.
- **Never** delete a skill without a second explicit confirmation for that
  exact skill name.
- **Always** back up before writing. The backup is the rollback path.
- **Never** widen a skill's activation past what the data supports. If a
  skill was invoked via slash 3x and auto 0x, recommend slash-only — don't
  recommend eager-loading just because the body is small.
- If the transcript sample is sparse (<3 sessions) or the candidate list is
  empty, say so and stop. Don't manufacture proposals.

## See also

- `references/activation-modes.md` — the exact frontmatter / hook shapes for
  each mode, plus failure modes and gotchas
- `optimize-permissions` — same UX shape, applied to tool allowlists
- Anthropic's progressive-disclosure guidance for skills — the design
  principle this skill helps you apply
