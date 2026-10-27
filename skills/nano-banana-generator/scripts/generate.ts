#!/usr/bin/env bun
/**
 * Nano Banana Generator - Generic image generation using Google's Gemini
 *
 * Usage:
 *   bun run generate.ts "your prompt" [options]
 *
 * Examples:
 *   bun run generate.ts "Art Deco logo with city skyline" --output ./logo.png
 *   bun run generate.ts "game title CITY TYCOON" --width 800 --height 200
 */

import { parseArgs } from "util";
import { mkdir, writeFile, readFile } from "fs/promises";
import { dirname } from "path";
import { imageFormat, prepareOutput } from "./image-output";

export const MODEL_MAP: Record<string, string> = {
  "nano-banana-pro": "gemini-3-pro-image",
  "nano-banana-2.1": "gemini-nano-banana-2.1",
  "nano-banana-2": "gemini-nano-banana-2.1", // Backward-compatible CLI alias.
};

const SUPPORTED_ASPECT_RATIOS = [
  "1:8",
  "1:4",
  "2:3",
  "3:4",
  "4:5",
  "1:1",
  "5:4",
  "4:3",
  "3:2",
  "16:9",
  "21:9",
  "4:1",
  "8:1",
] as const;

function nearestAspectRatio(width: number, height: number): string {
  const requestedRatio = width / height;

  return SUPPORTED_ASPECT_RATIOS.reduce((nearest, candidate) => {
    const [candidateWidth, candidateHeight] = candidate.split(":").map(Number);
    const [nearestWidth, nearestHeight] = nearest.split(":").map(Number);
    const candidateDistance = Math.abs(Math.log(requestedRatio / (candidateWidth / candidateHeight)));
    const nearestDistance = Math.abs(Math.log(requestedRatio / (nearestWidth / nearestHeight)));

    return candidateDistance < nearestDistance ? candidate : nearest;
  });
}

export function imageSize(width: number, height: number): "1K" | "2K" | "4K" {
  const largestDimension = Math.max(width, height);

  if (largestDimension <= 1024) return "1K";
  if (largestDimension <= 2048) return "2K";
  return "4K";
}

export async function generateImage(
  prompt: string,
  model: string,
  width: number,
  height: number,
  inputImagePath?: string
): Promise<ArrayBuffer> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY environment variable not set.\n" +
        "Get one at: https://aistudio.google.com/"
    );
  }

  const aspectRatio = nearestAspectRatio(width, height);
  const outputSize = imageSize(width, height);

  // Interactions uses typed content blocks, not generateContent parts.
  const input: Array<
    { type: "text"; text: string }
    | { type: "image"; mime_type: string; data: string }
  > = [];

  // If input image provided, add it first
  if (inputImagePath) {
    const imageBuffer = await readFile(inputImagePath);
    const base64Image = imageBuffer.toString("base64");
    const mimeType = `image/${imageFormat(imageBuffer)}`;
    input.push({
      type: "image",
      mime_type: mimeType,
      data: base64Image,
    });
  }

  // Add text prompt
  input.push({ type: "text", text: prompt });

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/interactions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        model,
        input,
        store: false,
        response_format: {
          type: "image",
          aspect_ratio: aspectRatio,
          image_size: outputSize,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API request failed: ${response.status} - ${error}`);
  }

  const data = await response.json() as {
    status?: string;
    steps?: Array<{
      type: string;
      content?: Array<{ type: string; data?: string }>;
    }>;
  };

  if (data.status !== "completed") {
    throw new Error(`Image generation did not complete (status: ${data.status ?? "missing"})`);
  }

  // Ignore thought/tool steps; only model output contains the requested image.
  for (const step of data.steps ?? []) {
    if (step.type !== "model_output") continue;
    for (const content of step.content ?? []) {
      if (content.type === "image" && content.data) {
        const binaryString = atob(content.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
      }
    }
  }

  throw new Error("No image generated in response");
}

export async function main(args = Bun.argv.slice(2)) {
  const { values, positionals } = parseArgs({
    args,
    options: {
      output: { type: "string", short: "o", default: "./output.jpg" },
      input: { type: "string", short: "i" },
      model: { type: "string", short: "m", default: "nano-banana-pro" },
      width: { type: "string", short: "w", default: "512" },
      height: { type: "string", short: "h", default: "512" },
      style: { type: "string", short: "s" },
      help: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  if (values.help || positionals.length === 0) {
    console.log(`
Nano Banana Generator - Create images with Google's Gemini

Usage:
  bun run generate.ts "<prompt>" [options]

Options:
  -o, --output <path>     Exact output path; .jpg/.jpeg, .png, or .webp (default: ./output.jpg)
  -i, --input <path>      Input image for image-to-image editing
  -m, --model <model>     Model: nano-banana-pro (default, best quality) or nano-banana-2.1 (faster)
                         nano-banana-2 remains an alias for nano-banana-2.1
  -w, --width <px>        Image width (default: 512)
  -h, --height <px>       Image height (default: 512)
  -s, --style <desc>      Add style modifier to prompt
      --help              Show this help

Examples:
  bun run generate.ts "Art Deco city logo" --output ./logo.png
  bun run generate.ts "CITY TYCOON title" --width 800 --height 200
  bun run generate.ts "game icon" --model nano-banana-2.1
  bun run generate.ts "add flowers to grass" --input ./grass.png --output ./grass_flowers.png
`);
    return;
  }

  // Get prompt from positional args
  const userPrompt = positionals.join(" ");

  const modelName = values.model || "nano-banana-pro";
  const modelId = MODEL_MAP[modelName];

  if (!modelId) {
    throw new Error(
      `Unknown model: ${modelName}. Use 'nano-banana-pro' or 'nano-banana-2.1'`
    );
  }

  const width = parseInt(values.width || "512", 10);
  const height = parseInt(values.height || "512", 10);

  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new Error("Width and height must be positive integers");
  }

  // Build full prompt
  let prompt = userPrompt;

  if (values.style) {
    prompt = `${prompt}. Style: ${values.style}`;
  }

  const output = await prepareOutput(values.output || "./output.jpg");

  console.log(`Generating image...`);
  console.log(`Prompt: ${userPrompt}`);
  console.log(`Model: ${modelName}`);
  console.log(
    `Requested size: ${width}x${height} (API: ${nearestAspectRatio(width, height)}, ${imageSize(width, height)})`
  );
  console.log(`Output: ${output.path}`);

  if (values.input) {
    console.log(`Input: ${values.input}`);
  }

  const imageData = await generateImage(prompt, modelId, width, height, values.input);
  const bytes = await output.encode(imageData);

  // Convert and validate before touching the destination. Never rename the path.
  await mkdir(dirname(output.path), { recursive: true });
  await writeFile(output.path, bytes);
  console.log(`\n✓ Image saved to: ${output.path}`);
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(`\n✗ Error: ${error}`);
    process.exitCode = 1;
  });
}
