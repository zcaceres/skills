# quality-socket

Set up [Socket Security](https://socket.dev) on the current repo. Socket's
integration is a GitHub App, not a checked-in config file, so the skill is
mostly a guided walkthrough plus a verification step that catches the common
failure mode of installing the App on the wrong account.

1. **Web install walkthrough.** Print the two-step OAuth flow (socket.dev
   sign-in → GitHub App install screen) with the right account / repo
   selections highlighted, then wait for the user to finish.
2. **API verification.** Once the user reports they're done, query
   `gh api /user/installations` for the `socket-security` app slug, confirm
   it's on the account that owns this repo, and check that the current
   repo is in its selected-repos list. Catches "I installed it on my personal
   account but the repo lives in an org" before the user moves on.
3. **Optional CI workflow.** Only on request. Socket's App already comments
   on every PR that changes a dependency manifest; the CI workflow is a
   backstop for users who want a required status check, force-push coverage,
   or local reproducibility. Requires a `SOCKET_SECURITY_API_KEY` secret.

User-triggered only — activates when the user invokes `/quality-socket`.

## Layout

- `SKILL.md` — workflow + per-finding triage cheat-sheet (typosquats,
  install scripts, native code, telemetry, unmaintained)
- `assets/socket.yml` — optional CI workflow template, npm-pinned socket CLI

## Install

```
npx skills add zcaceres/skills -s quality-socket
```

Add `-g` for global install, or `-a <agent>` to target a specific agent.
