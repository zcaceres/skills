# nano-banana-generator

Claude Code and Codex skill that generates graphic assets — logos, icons,
illustrations, UI elements, one-off graphics — using Google's Nano
Banana Pro (Gemini image generation API) via a bundled `bun` helper.
Supports text-to-image and image-to-image editing, custom dimensions,
JPEG/PNG/WebP output, and style modifiers. It defaults to Google's
stable `gemini-3-pro-image` model for the best output quality and offers
`gemini-nano-banana-2.1` (Nano Banana 2.1) for faster generation
(`--model nano-banana-2.1`; the old `nano-banana-2` CLI name remains an alias).
Requests use Google's Interactions API (`POST /v1beta/interactions`, as in
Google's [image-generation guide](https://ai.google.dev/gemini-api/docs/image-generation))
with native aspect-ratio and output-size settings. Each request sets
`store: false` to disable interaction storage and keep the helper stateless.
Both models support `1K`, `2K`, and `4K` output; small requests use `1K` rather
than `512`.

Native JPEG is saved unchanged at `./output.jpg` by default. An explicit output
extension selects the saved encoding: `--output logo.png` converts the returned
JPEG to a real PNG at exactly `logo.png`; `.webp` works the same way. Matching
native encodings are preserved without recompression. The helper validates image
signatures and never automatically changes your output path.

Transparency is not supported. The former `--transparent` / `-t` options have
been removed; format conversion does not remove a background or create alpha.

See [SKILL.md](./SKILL.md) for usage, the full option table, and
prompt tips.

## Install

```sh
npx skills add zcaceres/skills -s nano-banana-generator
```

Add `-g` for global install, or `-a <agent>` to target a specific agent.
For Codex, invoke it with `$nano-banana-generator`.

After installing the skill, provision its image converter once:

```sh
bun "$SKILL_DIR/scripts/setup-converter.ts"
```

Set `SKILL_DIR` to the installed skill's directory (see [SKILL.md](./SKILL.md)).
Setup uses Bun to install pinned, lockfile-verified Sharp dependencies for the
current platform; it does not require ImageMagick, Python, or macOS tools.
For an offline install with the packages already cached, append `--offline`.
In this repository, `bun install --frozen-lockfile` also provisions Sharp.

The generator checks converter availability and codec support before each paid
API call. Missing dependencies fail with setup instructions, without calling
Gemini or silently downloading packages. The distributed skill does not ship
the build machine's platform-specific `node_modules`.

## Requirements

- `bun` on `$PATH` (used to run `scripts/generate.ts`)
- Sharp, provisioned by the setup command above
- `GEMINI_API_KEY` environment variable — get a key at
  [Google AI Studio](https://aistudio.google.com/). The key is read
  from the environment at runtime; nothing is stored on disk.
