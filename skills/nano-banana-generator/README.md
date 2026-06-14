# nano-banana-generator

Claude Code skill that generates graphic assets — logos, icons,
illustrations, UI elements, one-off graphics — using Google's Nano
Banana (Gemini image generation API) via a bundled `bun` helper.
Supports text-to-image and image-to-image editing, custom dimensions,
transparent backgrounds, and style modifiers.

See [SKILL.md](./SKILL.md) for usage, the full option table, and
prompt tips.

## Install

```sh
npx skills add zcaceres/skills -s nano-banana-generator
```

Add `-g` for global install, or `-a <agent>` to target a specific agent.

## Requirements

- `bun` on `$PATH` (used to run `scripts/generate.ts`)
- `GEMINI_API_KEY` environment variable — get a key at
  [Google AI Studio](https://aistudio.google.com/). The key is read
  from the environment at runtime; nothing is stored on disk.
