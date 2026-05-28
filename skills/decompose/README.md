# decompose

Claude Code slash command for breaking a stuck problem into smaller, tractable
pieces. Diagnoses the kind of stuck (opacity, paralysis, bug fog, scope,
concept fuzz, design uncertainty) and applies 1–3 lenses to the situation.
Pure-thinking tool — does not edit files.

**Usage:** `/decompose [focus]`

See [SKILL.md](./SKILL.md) for the lens library, parsing rules, and output
format.

## Install

```sh
skills install @zcaceres/decompose
```

Or grab the tarball from the latest
[GitHub release](https://github.com/zcaceres/skills/releases?q=decompose).

## Origin

Ported from
[`zcaceres/claude-decompose`](https://github.com/zcaceres/claude-decompose)
into this monorepo. Body preserved verbatim; frontmatter adds
`disable-model-invocation: true` so the skill only fires when the user
explicitly types `/decompose`.
