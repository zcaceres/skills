# nano-banana-generator

Claude Code skill that generates graphic assets — logos, icons,
illustrations, UI elements, one-off graphics — using Google's Nano
Banana Pro (Gemini image generation API) via a bundled `bun` helper.
Supports text-to-image and image-to-image editing, custom dimensions,
transparent backgrounds, and style modifiers. It defaults to Google's
stable `gemini-3-pro-image` model for the best output quality and offers
`gemini-3.1-flash-image` (Nano Banana 2) for faster generation. Requests use
Google's stable `generateContent` API with native aspect-ratio and output-size
settings.

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
