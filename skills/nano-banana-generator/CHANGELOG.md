# @zcaceres/skill-nano-banana-generator

## 0.3.0

### Minor Changes

- 6fa5c11: Remove the nano-banana-2 model alias. Only nano-banana-pro and nano-banana-2.1
  are supported; unsupported model names fail before generation.
- e68463a: Upgrade the fast model to Nano Banana 2.1 and keep Pro as the default.
  Use supported 1K/2K/4K resolutions and migrate generation and
  image editing to the Interactions API with interaction storage disabled.
- e68463a: Honor exact JPEG, PNG, and WebP output paths with real local conversion using
  pinned Sharp dependencies. Preflight codecs before paid generation, preserve
  matching native bytes, and remove the unsupported --transparent/-t flags.

### Patch Changes

- baa1312: Align the fast model's 4K panorama validation with the observed 8256×2048 API
  output and document the difference from Google's published size table.
- 9d684ce: Document a repeatable validation runbook covering model, resolution, format,
  style, editing, setup, and error behavior with technical and visual checks.
- e68463a: Validate returned image signatures instead of writing JPEG responses under
  misleading extensions. Default to output.jpg and reject unknown image formats.

## 0.2.1

### Patch Changes

- 5944eb0: Document Codex invocation and use an agent-neutral skill-directory reference for
  the image-generation helper.

## 0.2.0

### Minor Changes

- c653b89: Default to the stable Nano Banana Pro model for best-quality image generation, add Nano Banana 2 as the faster alternative, and use native aspect-ratio and output-size configuration.

## 0.1.0

### Minor Changes

- 4d34224: New skill `nano-banana-generator` — generates graphic assets (logos, icons,
  illustrations, UI elements) using Google's Nano Banana (Gemini image
  generation API) via a bundled `bun` helper. Supports text-to-image and
  image-to-image editing, custom dimensions, transparent backgrounds, style
  modifiers, and a fast (`nano-banana`) or high-quality (`nano-banana-pro`)
  model choice.
