# zoom

Claude Code slash command for shifting the conversation's abstraction level
along a 7-rung ladder (expression → block → function → file → module →
subsystem → system, plus product/domain above). Pure-thinking tool — does
not edit files.

**Usage:** `/zoom in|out [target | rung | count]`

```
/zoom in              # one rung deeper from current focus
/zoom in 2            # two rungs deeper
/zoom in function     # jump to the function rung
/zoom out             # one rung outward
/zoom out module      # jump to module rung
/zoom out "the payments flow"
```

See [SKILL.md](./SKILL.md) for the ladder, parsing rules, edge cases, and
output format.

## Install

```sh
skills install @zcaceres/zoom
```

Or grab the tarball from the latest
[GitHub release](https://github.com/zcaceres/skills/releases?q=zoom).

## Origin

Consolidated from
[`zcaceres/claude-zoom-in-out`](https://github.com/zcaceres/claude-zoom-in-out),
which shipped `/zoom-in` and `/zoom-out` as two distinct slash commands. In
this port the direction (`in`/`out`) is the first argument to a single
`/zoom` command. Behavior, ladder, parsing rules, and output format are
preserved.
