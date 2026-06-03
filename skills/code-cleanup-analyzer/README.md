# code-cleanup-analyzer

Analyze a codebase for dead code, duplicates, and circular dependencies using knip, jscpd, and madge, then validate findings to filter false positives. Use when user says 'analyze code', 'find dead code', 'code cleanup', 'find duplicates', 'unused exports', or 'static analysis'.

## Layout

- `SKILL.md` — manifest + instructions (skills.sh standard)
- `scripts/` — executables the skill calls
- `references/` — docs the skill reads
- `assets/` — templates, samples

## Install

```
npx skills add zcaceres/skills -s code-cleanup-analyzer
```