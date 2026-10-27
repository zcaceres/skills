---
name: nano-banana-generator
description: Generate graphic assets with Google's Nano Banana (Gemini image generation). Use for logos, icons, illustrations, UI elements, or other one-off graphics. Invoke with $nano-banana-generator in Codex.
---

# Nano Banana Generator

Generate arbitrary graphic assets using Google's Nano Banana (Gemini image generation API).

**Invocation:** `$nano-banana-generator` in Codex. Claude Code may invoke this
skill automatically or by name.

## Setup

1. Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/)
2. Set the environment variable:
   ```bash
   export GEMINI_API_KEY="your-api-key"
   ```

The script reads the key from the environment only — never hard-code it or
pass it as an argument.

## Usage

Run the helper from this skill's directory. In Claude Code, that directory is
`$CLAUDE_SKILL_DIR`. In Codex, use the absolute skill directory supplied with
this skill's metadata (typically `~/.codex/skills/nano-banana-generator`). Set
`SKILL_DIR` before running a command:

```bash
# Claude Code
SKILL_DIR="$CLAUDE_SKILL_DIR"

# Codex global installation (use the metadata path instead for a project skill)
SKILL_DIR="$HOME/.codex/skills/nano-banana-generator"
```

### Install the image converter once

```bash
bun "$SKILL_DIR/scripts/setup-converter.ts"
```

This installs a pinned, lockfile-verified Sharp dependency and the native modules
for the current platform. No ImageMagick, Python, or OS-specific conversion tool
is needed. Run setup again after moving an installation to a different platform.
In this repository, `bun install --frozen-lockfile` also provisions the dependency.

The helper checks the installed converter and JPEG/PNG/WebP codec support before
every Gemini request, even for JPEG destinations, so an unexpected API format
change cannot trigger a missing-dependency failure after a paid generation.
Missing or incompatible dependencies produce the setup command and no API call.
The generator never installs dependencies automatically.

```bash
# Basic usage - provide a prompt
bun "$SKILL_DIR/scripts/generate.ts" "Art Deco logo for City Tycoon game"

# Specify output path
bun "$SKILL_DIR/scripts/generate.ts" "icon of a golden skyscraper" --output ./logo.png

# Specify dimensions (mapped to the nearest supported aspect ratio and output size)
bun "$SKILL_DIR/scripts/generate.ts" "game title banner" --width 800 --height 200

# Use the faster Nano Banana 2.1 model
bun "$SKILL_DIR/scripts/generate.ts" "quick concept" --model nano-banana-2.1

# Image-to-image editing
bun "$SKILL_DIR/scripts/generate.ts" "add flowers to grass" --input ./grass.png --output ./grass_flowers.png
```

## Options

| Option | Short | Description |
|--------|-------|-------------|
| `--output <path>` | `-o` | Exact output path (default: ./output.jpg); .jpg/.jpeg, .png, or .webp selects the saved encoding |
| `--input <path>` | `-i` | Input image for image-to-image editing |
| `--width <px>` | `-w` | Desired image width; selects the nearest supported aspect ratio and output size (default: 512) |
| `--height <px>` | `-h` | Desired image height; selects the nearest supported aspect ratio and output size (default: 512) |
| `--model <name>` | `-m` | Model: nano-banana-pro (default, best quality) or nano-banana-2.1 (faster); nano-banana-2 is a compatibility alias for 2.1 |
| `--style <desc>` | `-s` | Add style modifier to prompt |
| `--help` | | Show help |

## Models

| Model | ID | Best For |
|-------|-----|----------|
| Nano Banana Pro (default) | `gemini-3-pro-image` | Professional-grade final assets and highest quality |
| Nano Banana 2.1 | `gemini-nano-banana-2.1` | Fast, high-volume generation and iteration |

The helper uses Google's Interactions API (`POST /v1beta/interactions`), following
the current [image-generation guide](https://ai.google.dev/gemini-api/docs/image-generation).
Requests explicitly set `store: false` to disable interaction storage and remain
stateless; input images are still uploaded to Google for generation/editing.
The helper maps `--width` and `--height` to the nearest supported
aspect ratio and output size. Both models support `1K`, `2K`, and `4K`; requests
at or below 1024 pixels use `1K` (there is no `512` output option). Generated
dimensions can differ from the exact requested pixel values.

## Output format

The default is native JPEG saved at `./output.jpg`. The output extension controls
the on-disk encoding, not the Gemini API request. For example,
`--output ./logo.png` converts a JPEG response to an actual PNG at exactly
`./logo.png`; `.webp` similarly produces WebP. Unsupported or missing extensions
are rejected before generation. Existing files at the requested path are replaced.

The helper checks source and converted-output byte signatures. When the source
already matches the destination encoding, it writes the original bytes without
recompression. Otherwise Sharp decodes and re-encodes locally; only after
successful conversion and validation is the destination written. Paths are never
automatically renamed, and unsupported PNG/WebP output parameters are not sent
to Gemini. Unknown source formats fail rather than being mislabeled.

Format conversion does not restore detail lost to JPEG compression or remove a
background. Transparency generation is not supported: `--transparent` and `-t`
have been removed and are rejected before any API call. Asking for transparency
in a prompt can produce an opaque checkerboard; PNG encoding does not fix that.

## Examples

### Game Logo
```bash
bun "$SKILL_DIR/scripts/generate.ts" \
  "Art Deco emblem with stylized city skyline, gold and navy colors, geometric sunburst" \
  --output ./public/assets/logo.png
```

### Title Banner
```bash
bun "$SKILL_DIR/scripts/generate.ts" \
  "Art Deco title banner with text 'CITY TYCOON' in bold geometric typeface, gold on navy" \
  --width 800 --height 200 \
  --output ./public/assets/title.png
```

### App Icon
```bash
bun "$SKILL_DIR/scripts/generate.ts" \
  "Minimalist isometric building icon, Art Deco style" \
  --width 256 --height 256 \
  --output ./public/icon.png
```

## Tips

- Be specific about colors using hex codes: "gold (#d4af37)"
- Specify style explicitly: "Art Deco", "flat design", "pixel art"
- Larger dimensions = more detail, but slower generation
- The default `nano-banana-pro` model provides the best output quality
- Use `nano-banana-2.1` when speed and generation volume matter more
