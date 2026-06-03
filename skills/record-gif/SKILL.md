---
name: record-gif
description: Record animated GIFs of web page animations using Playwright screenshots and ffmpeg. Use when capturing demos, UI animations, or feature previews for sharing.
---

# Record GIF

Record animated GIFs of web pages using Playwright frame capture and ffmpeg conversion.

## When to Use This Skill

- Record a GIF of a web page animation or demo
- Capture a UI feature for social sharing
- Create a screen recording of a website interaction
- Generate preview clips for documentation

## Prerequisites

- Playwright MCP plugin enabled
- ffmpeg installed (`brew install ffmpeg` on macOS, `apt install ffmpeg` on Linux)
- Dev server running on localhost

The commands below assume macOS (`open`, `trash`). On Linux substitute `xdg-open` and `rm`.

## Workflow

### Step 1: Ensure Dev Server is Running

```bash
# Check if server is responding
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/your-page

# If not running, start it
bun run dev &
sleep 5
```

### Step 2: Create Frames Directory

```bash
mkdir -p /tmp/gif-frames
trash /tmp/gif-frames/*.png 2>/dev/null || rm -f /tmp/gif-frames/*.png
```

The fallback to `rm -f` matters: if `trash` is missing or fails, stale higher-numbered frames from a prior longer run would otherwise survive and get spliced into the next GIF (ffmpeg reads `frame-%04d.png` sequentially until it hits a gap).

### Step 3: Capture Frames with Playwright

Use `mcp__plugin_playwright_playwright__browser_run_code_unsafe`:

```javascript
async (page) => {
  // Navigate to the target page
  await page.goto('http://localhost:3000/your-page');
  await page.waitForLoadState('networkidle');

  // Wait for animation to initialize
  await page.waitForTimeout(500);

  // Calculate frame count based on animation duration
  // Formula: frameCount = (durationMs / intervalMs)
  // Example: 11 seconds at 100ms intervals = 110 frames
  const frameCount = 110;
  const intervalMs = 100; // 100ms = 10fps

  for (let i = 0; i < frameCount; i++) {
    await page.screenshot({
      path: `/tmp/gif-frames/frame-${String(i).padStart(4, '0')}.png`,
      type: 'png'
    });
    await page.waitForTimeout(intervalMs);
  }

  return `Captured ${frameCount} frames`;
}
```

### Step 4: Convert to GIF with ffmpeg

```bash
ffmpeg -y \
  -framerate 10 \
  -i /tmp/gif-frames/frame-%04d.png \
  -vf "fps=10,scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" \
  output.gif
```

### Step 5: Verify and Open

```bash
ls -lh output.gif         # Check file size
open output.gif           # macOS — preview the GIF (Linux: xdg-open output.gif)
```

## Configuration Options

### Frame Rate Presets

| FPS | Interval | Use Case |
|-----|----------|----------|
| 5 | 200ms | Small files, simple animations |
| 10 | 100ms | Default - good balance |
| 15 | 66ms | Smoother motion |
| 20 | 50ms | High quality, large files |

### Duration Calculator

```
frameCount = durationSeconds × fps

Examples:
- 5 seconds at 10fps = 50 frames
- 10 seconds at 10fps = 100 frames
- 15 seconds at 10fps = 150 frames
```

### Output Width Presets

| Width | Use Case | File Size |
|-------|----------|-----------|
| 400px | Thumbnails | ~50-100KB |
| 600px | Email/chat | ~100-200KB |
| 800px | Default/docs | ~200-400KB |
| 1200px | High quality | ~400-800KB |

Adjust in ffmpeg: `scale=WIDTH:-1`

### Optimize File Size

For smaller GIFs, reduce color palette:

```bash
ffmpeg -y \
  -framerate 10 \
  -i /tmp/gif-frames/frame-%04d.png \
  -vf "fps=10,scale=600:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer" \
  output-optimized.gif
```

## Complete Example

Record an 11-second animation at 10fps, 800px wide:

```bash
# 1. Prep
mkdir -p /tmp/gif-frames
trash /tmp/gif-frames/*.png 2>/dev/null || rm -f /tmp/gif-frames/*.png
```

```javascript
// 2. Capture (via Playwright MCP — browser_run_code_unsafe)
async (page) => {
  await page.goto('http://localhost:3000/demo/email-validator');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  for (let i = 0; i < 110; i++) {
    await page.screenshot({
      path: `/tmp/gif-frames/frame-${String(i).padStart(4, '0')}.png`,
      type: 'png'
    });
    await page.waitForTimeout(100);
  }
  return 'Done';
}
```

```bash
# 3. Convert
ffmpeg -y -framerate 10 \
  -i /tmp/gif-frames/frame-%04d.png \
  -vf "fps=10,scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" \
  ~/demo.gif

# 4. Check & open
ls -lh ~/demo.gif
open ~/demo.gif
```

## Troubleshooting

### Dev server not responding

```bash
# Kill and restart
lsof -ti:3000 | xargs kill -9 2>/dev/null
bun run dev &
sleep 5
```

### Animation not captured from start

Increase the initial wait time before capture loop:
```javascript
await page.waitForTimeout(1000); // Wait longer for animation to reset
```

### GIF too large

1. Reduce width: `scale=600:-1`
2. Reduce fps: use 5fps instead of 10
3. Reduce colors: `palettegen=max_colors=128`
4. Shorten duration

### GIF too choppy

1. Increase fps (capture more frequently)
2. Use smaller interval: 66ms for 15fps

### Frames not numbered correctly

Ensure padded numbering in screenshot path:
```javascript
`frame-${String(i).padStart(4, '0')}.png`  // frame-0000.png, frame-0001.png, etc.
```
