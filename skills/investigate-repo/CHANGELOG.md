# @zcaceres/skill-investigate-repo

## 1.0.1

### Patch Changes

- cb98359: Add explicit Codex invocation metadata and documentation to the selected skills,
  plus native Codex hook installation for dotenv, 1Password credential, and
  Supply-Chain Firewall guards.

## 1.0.0

### Major Changes

- Initial release: Claude Code skill for auditing an unfamiliar third-party
  GitHub repo before adoption. Clones shallow into a temp dir, sweeps for
  malicious-pattern signatures (eval / postinstall / exfil URLs / obfuscated
  payloads / native binaries), and emits a verdict — SAFE / SUSPICIOUS /
  DANGEROUS / INCONCLUSIVE — with file:line evidence. Pure-markdown skill, no
  binaries or install-time side effects.

  Ported from
  [`zcaceres/claude-investigate-repo`](https://github.com/zcaceres/claude-investigate-repo)
  with the workflow preserved verbatim.
