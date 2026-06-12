---
name: nano-banana-generator
description: Generate arbitrary graphic assets using Google's Nano Banana (Gemini image generation). Use for logos, icons, illustrations, UI elements, or any one-off graphics.
---

# Nano Banana Generator

Generate arbitrary graphic assets using Google's Nano Banana (Gemini image generation API).

## Setup

1. Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/)
2. Set the environment variable:
   ```bash
   export GEMINI_API_KEY="your-api-key"
   ```

The script reads the key from the environment only — never hard-code it or
pass it as an argument.

## Usage

```bash
# Basic usage - provide a prompt
bun "${CLAUDE_SKILL_DIR}/scripts/generate.ts" "Art Deco logo for City Tycoon game"

# Specify output path
bun "${CLAUDE_SKILL_DIR}/scripts/generate.ts" "icon of a golden skyscraper" --output ./logo.png

# Specify dimensions
bun "${CLAUDE_SKILL_DIR}/scripts/generate.ts" "game title banner" --width 800 --height 200

# Use higher quality model
bun "${CLAUDE_SKILL_DIR}/scripts/generate.ts" "detailed illustration" --model nano-banana-pro

# Request transparent background
bun "${CLAUDE_SKILL_DIR}/scripts/generate.ts" "app icon" --transparent

# Image-to-image editing
bun "${CLAUDE_SKILL_DIR}/scripts/generate.ts" "add flowers to grass" --input ./grass.png --output ./grass_flowers.png
```

## Options

| Option | Short | Description |
|--------|-------|-------------|
| `--output <path>` | `-o` | Output file path (default: ./output.png) |
| `--input <path>` | `-i` | Input image for image-to-image editing |
| `--width <px>` | `-w` | Image width (default: 512) |
| `--height <px>` | `-h` | Image height (default: 512) |
| `--model <name>` | `-m` | Model: nano-banana (default) or nano-banana-pro |
| `--transparent` | `-t` | Request transparent PNG background |
| `--style <desc>` | `-s` | Add style modifier to prompt |
| `--help` | | Show help |

## Models

| Model | ID | Best For |
|-------|-----|----------|
| Nano Banana | `gemini-2.5-flash-image` | Fast iteration, testing |
| Nano Banana Pro | `gemini-3-pro-image-preview` | Final assets, higher quality |

## Examples

### Game Logo
```bash
bun "${CLAUDE_SKILL_DIR}/scripts/generate.ts" \
  "Art Deco emblem with stylized city skyline, gold and navy colors, geometric sunburst" \
  --output ./public/assets/logo.png \
  --transparent
```

### Title Banner
```bash
bun "${CLAUDE_SKILL_DIR}/scripts/generate.ts" \
  "Art Deco title banner with text 'CITY TYCOON' in bold geometric typeface, gold on navy" \
  --width 800 --height 200 \
  --output ./public/assets/title.png
```

### App Icon
```bash
bun "${CLAUDE_SKILL_DIR}/scripts/generate.ts" \
  "Minimalist isometric building icon, Art Deco style" \
  --width 256 --height 256 \
  --transparent \
  --output ./public/icon.png
```

## Tips

- Be specific about colors using hex codes: "gold (#d4af37)"
- Specify style explicitly: "Art Deco", "flat design", "pixel art"
- For transparent backgrounds, always include `--transparent`
- Larger dimensions = more detail, but slower generation
- Use `nano-banana-pro` for final production assets
