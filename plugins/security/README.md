# security (Claude Code plugin)

Repo + endpoint security setup: OpenSSF Scorecard, gitleaks, Snyk, Socket, and the bumblebee endpoint scanner. User-triggered via /security:<tool>.

| Skill | What it does |
|---|---|
| `/security:bumblebee` | Set up and use Perplexity's bumblebee endpoint scanner for supply-chain exposure checks. |
| `/security:gitleaks` | Set up gitleaks secret-scanning on a repo. |
| `/security:openssf` | Scaffold OpenSSF Scorecard GitHub Action on a public repo with a safe two-phase rollout — first run with… |
| `/security:scfw` | Set up and use Datadog's Supply-Chain Firewall (scfw) to block known-malicious npm/PyPI/Poetry packages at install time. |
| `/security:snyk` | Set up Snyk on a repo. |
| `/security:socket` | Set up Socket Security (socket.dev) on a repo. |

## Install

```shell
/plugin marketplace add zcaceres/skills
/plugin install security@zcaceres-skills
```

## Develop / test locally

```bash
claude --plugin-dir ./plugins/security
/reload-plugins   # after edits
```

> Generated from `skills/security-*` by `bun run build:plugins`. Edit the originals under `skills/`, not these copies.
