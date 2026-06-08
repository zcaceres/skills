# optimize-permissions

Scan recent conversation transcripts for safe commands that could be auto-allowed by your CLI agent (Claude Code, Codex, Cursor, …), preview the proposed allowlist changes, then write them to the right config. Use when the user says 'reduce permission prompts', 'auto-allow safe commands', 'optimize permissions', or '/optimize-permissions'.

## Layout

- `SKILL.md` — manifest + instructions (skills.sh standard)
- `scripts/` — executables the skill calls
- `references/` — docs the skill reads
- `assets/` — templates, samples

## Install

```
npx skills add zcaceres/skills -s optimize-permissions
```

Add `-g` for global install, or `-a <agent>` to target a specific agent.
