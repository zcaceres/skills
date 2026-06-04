# investigate-repo

Claude Code skill for auditing an unfamiliar GitHub repo before you run it.
Clones shallow into a temp dir, sweeps for malicious patterns (`eval`,
postinstall hooks, hardcoded URLs to exfil services, obfuscated payloads),
reads entry points, and emits a verdict — SAFE / SUSPICIOUS / DANGEROUS /
INCONCLUSIVE — with file:line evidence.

See [SKILL.md](./SKILL.md) for the workflow, the pattern sweeps, and the
red-flag reference.

## Install

```sh
npx skills add zcaceres/skills -s investigate-repo
```

This is a pure-markdown skill — no binaries, no install-time side effects.

## Origin

Ported from
[`zcaceres/claude-investigate-repo`](https://github.com/zcaceres/claude-investigate-repo)
into this monorepo. Body and workflow are preserved verbatim.
