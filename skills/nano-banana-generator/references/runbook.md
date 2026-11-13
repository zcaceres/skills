# Nano Banana validation runbook

Run before release or after changing generation, conversion, or setup.
The live section makes **9 paid Gemini requests**, including two 4K generations.
Run it only when live validation is requested. Keep failures; do not silently skip cases.

## 1. Setup and offline checks

From the repository root:

```sh
bun install --frozen-lockfile
bun run --cwd skills/nano-banana-generator test
export SKILL_DIR="$PWD/skills/nano-banana-generator"
```

The tests cover codecs, exact paths, native-byte preservation, API errors,
invalid arguments, and missing-converter failure before any paid request.
They also build and test an isolated installed copy. They do not call Gemini.

For an installed skill, set `SKILL_DIR` to its absolute path instead; run the
automated tests in the repository, since installed skills do not include tests.

```sh
bun "$SKILL_DIR/scripts/setup-converter.ts"
bun "$SKILL_DIR/scripts/generate.ts" --help
: "${GEMINI_API_KEY:?Supply GEMINI_API_KEY in your environment; never put it in this file}"
export RUN_DIR="$(mktemp -d)"
cd "$RUN_DIR"
gen() { bun "$SKILL_DIR/scripts/generate.ts" "$@"; }
```

Use a fresh output directory each time so old images cannot masquerade as passes.

## 2. Live matrix

Run these in order; editing cases reuse earlier outputs. Stop if a prerequisite fails.

```sh
set -e
PROMPT="A yellow banana centered on a solid blue background, no text."
gen "$PROMPT"
gen "$PROMPT" --model nano-banana-pro -w 1920 -h 1080 -s "flat illustration" -o pro-2k.png
gen "$PROMPT" --width 4096 --height 4096 --output pro-4k.webp
gen "$PROMPT" -m nano-banana-2.1 -o fast-1k.jpeg
gen "$PROMPT" --model nano-banana-2.1 --width 1536 --height 2048 --output fast-2k.png
gen "$PROMPT" --model nano-banana-2.1 --width 4096 --height 1024 --output fast-4k.webp
gen "Change only the background to green." -i output.jpg -o pro-edit.png
gen "Change only the background to red." -m nano-banana-2.1 -i pro-edit.png -o fast-edit.jpg
gen "Change only the background to purple." -m nano-banana-2.1 -i pro-4k.webp -o webp-edit.png
```

| Case | Output | Coverage |
|---|---|---|
| 1 | `output.jpg` | Default Pro, native JPEG, 1K square |
| 2 | `pro-2k.png` | Explicit Pro, PNG conversion, 2K landscape, style, short options |
| 3 | `pro-4k.webp` | Pro, WebP conversion, 4K |
| 4 | `fast-1k.jpeg` | Fast, native JPEG, 1K, `.jpeg` extension |
| 5 | `fast-2k.png` | Fast, PNG conversion, 2K portrait |
| 6 | `fast-4k.webp` | Fast, WebP conversion, 4K panorama |
| 7 | `pro-edit.png` | Pro editing, JPEG input |
| 8 | `fast-edit.jpg` | Fast editing, PNG input |
| 9 | `webp-edit.png` | Fast editing, WebP input |

## 3. Verify and record

Every command must exit zero and save at the exact requested path. Run this with
the same provisioned converter to verify encoding, full decoding, and dimensions:

```sh
cd "$SKILL_DIR/scripts/converter"
bun --no-install -e '
const sharp = require("sharp");
const { join } = require("node:path");
const cases = [
  ["output.jpg", "jpeg", 1024, 1024],
  ["pro-2k.png", "png", 2752, 1536],
  ["pro-4k.webp", "webp", 4096, 4096],
  ["fast-1k.jpeg", "jpeg", 1024, 1024],
  ["fast-2k.png", "png", 1792, 2400],
  ["fast-4k.webp", "webp", 8256, 2048],
  ["pro-edit.png", "png", 1024, 1024],
  ["fast-edit.jpg", "jpeg", 1024, 1024],
  ["webp-edit.png", "png", 1024, 1024],
];
for (const [name, format, width, height] of cases) {
  const image = sharp(join(process.env.RUN_DIR, name));
  const info = await image.metadata();
  await image.raw().toBuffer();
  if (info.format !== format || info.width !== width || info.height !== height)
    throw new Error(`${name}: unexpected format or dimensions: ${JSON.stringify(info)}`);
  console.log(`PASS ${name}: ${format} ${width}x${height}`);
}
'
```

These are the expected API output sizes, not the requested pixel sizes.
Nano Banana 2.1's 4:1 / 4K output was **8256×2048** in live validation on
2026-11-13, despite the [API size tables](https://ai.google.dev/gemini-api/docs/image-generation#aspect-ratios-and-image-size)
listing 8192×2048. Preserve the returned dimensions; do not resize to match the
table. If sizes change again, record the observed dimensions and check the docs
before updating these exact expectations.

Open all nine images. Check the banana, background colors, landscape/portrait/
panorama shapes, and style. Edits must change the background while retaining the
banana. A decodable file alone is not a visual pass.

Record the date, commit, platform, offline-test result, and **pass/fail/not run**
for each live case, plus the output directory and any errors. Do not mark the
runbook passed unless all nine cases pass both technical and visual checks.
