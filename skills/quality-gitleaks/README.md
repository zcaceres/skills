# quality-gitleaks

Set up [gitleaks](https://github.com/gitleaks/gitleaks) secret-scanning on a
repo with the right order of operations:

1. **Baseline scan first.** Scan full git history + working tree. If anything
   matches, **stop** — installing a hook on top of a dirty repo locks the user
   out of committing, and installing CI turns the default branch permanently
   red. The user has to triage (rotate, scrub, allowlist) before continuing.
2. **Config.** Scaffold `.gitleaks.toml` that extends the gitleaks default
   ruleset and prompts for opt-in custom rules (Anthropic key, Google OAuth
   secret, personal home paths).
3. **Local pre-commit hook.** `.githooks/pre-commit` scanning staged changes
   with `--redact`. Per-clone opt-in via `git config core.hooksPath .githooks`.
4. **CI workflow.** `.github/workflows/gitleaks.yml` scans both `git` history
   and the `dir` working tree on every push and PR. gitleaks is installed via
   a curl-pinned tarball rather than a marketplace action, so the version
   pin lives in the workflow file itself.

Activates on "add gitleaks", "set up secret scanning", "gitleaks boilerplate",
or `/quality-gitleaks`.

## Layout

- `SKILL.md` — workflow + triage cheat-sheet for the common pre-commit / CI
  failure modes
- `assets/gitleaks.toml` — config template (copied to repo as `.gitleaks.toml`), extends gitleaks defaults
- `assets/pre-commit` — local hook template, `gitleaks git --staged --redact`
- `assets/gitleaks.yml` — CI workflow template, curl-pinned gitleaks install

## Install

```
npx skills add zcaceres/skills -s quality-gitleaks
```

Add `-g` for global install, or `-a <agent>` to target a specific agent.
