---
"@zcaceres/skill-pr": minor
---

Activate the opt-in Jujutsu (jj) backend. The dispatcher resolves `git config pr.backend` (falling back to `.jj/` auto-detection) before the mode and routes workflow subcommands to the `references/jj/` docs; `/pr setup jj` bootstraps a colocated repo (`jj git init --colocate`) and writes the local `pr.backend` key, `/pr setup git` switches back. git stays the default backend and the git docs are unchanged.
