# optimize-skill-activation

Audit installed skills and right-size their activation mode — slash-only, model-invocable (name+description in context), or eager-loaded (full body up front). Preview changes, then rewrite each SKILL.md frontmatter. Use when the user says 'optimize skills', 'right-size skills', 'reduce skill tokens', 'audit skill activation', or '/optimize-skill-activation'.

## Layout

- `SKILL.md` — manifest + instructions (skills.sh standard)
- `scripts/` — executables the skill calls
- `references/` — docs the skill reads
- `assets/` — templates, samples

## Install

```
npx skills add zcaceres/skills -s optimize-skill-activation
```

Add `-g` for global install, or `-a <agent>` to target a specific agent.
