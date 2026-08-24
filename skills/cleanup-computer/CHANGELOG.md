# @zcaceres/skill-cleanup-computer

## 0.1.2

### Patch Changes

- c3f46c3: Make Delta-exposed skills manual-invocation only

## 0.1.1

### Patch Changes

- cb98359: Add explicit Codex invocation metadata and documentation to the selected skills,
  plus native Codex hook installation for dotenv, 1Password credential, and
  Supply-Chain Firewall guards.

## 0.1.0

### Minor Changes

- 702bdfd: Add a git worktree cleanup phase. Sweeps repos under common dev roots, classifies
  each linked worktree, and proposes removal only for safe candidates — clean
  working tree and branch fully merged into trunk. Never uses `git worktree remove
--force`; keeps dirty, unmerged, or locked worktrees and flags them.
