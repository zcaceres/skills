---
"@zcaceres/skill-pr": minor
---

pr: add the jj (jujutsu) workflow recipes under `references/jj/` — `update`, `checkpoint`, `submit`, `sync`, `merge`, `log`. `/pr setup jj` is now fully functional. The jj path needs no external stack tool (the commit graph is the stack): checkpoint uses `jj split <paths>` for safe slicing, submit enumerates the stack from a revset and maps each slice to its parent bookmark, sync is a single `jj rebase -b`, and every push is preceded by a mandatory conflict guard (`jj log -r 'conflicts()'`) since jj rebases record conflicts instead of halting. The GitHub layer (`gh pr create/edit/merge`) is unchanged from the git path. `title-convention.md` and `recovery.md` gain compact jj variants for their few VCS-specific commands.
