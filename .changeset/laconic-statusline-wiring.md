---
"@zcaceres/skill-laconic": minor
---

install.sh now wires the status-line badge by default. It saves any existing
`.statusLine` and routes it through a new `statusline.sh` wrapper that runs your
original status line and appends `◆ laconic` when the voice is on (invisible when
off). Opt out with `install.sh --no-statusline`. `uninstall.sh` restores the
saved original; `uninstall.sh --statusline-only` restores it without touching the
hook or state. Wiring is idempotent.
