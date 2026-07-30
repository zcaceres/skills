#!/usr/bin/env bun
/**
 * Nano Banana Generator - Generic image generation using Google's Gemini
 *
 * Usage:
 *   bun run generate.ts "your prompt" [options]
 *
 * Examples:
 *   bun run generate.ts "Art Deco logo with city skyline" --output ./logo.png
 *   bun run generate.ts "game title CITY TYCOON" --width 800 --height 200 --transparent
 */

import { parseArgs } from "util";
import { mkdir, writeFile, readFile } from "fs/promises";
import { dirname } from "path";

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

function imageSize(
  width: number,
  height: number,
  model: string
): "512" | "1K" | "2K" | "4K" {
  const largestDimension = Math.max(width, height);

  if (largestDimension <= 512 && model === "gemini-3.1-flash-image") return "512";
  if (largestDimension <= 1024) return "1K";
  if (largestDimension <= 2048) return "2K";
  return "4K";
}

async function generateImage(
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
  const outputSize = imageSize(width, height, model);

  // Build generateContent request parts.
  const parts: Array<
    { text: string }
    | { inlineData: { mimeType: string; data: string } }
  > = [];

  // If input image provided, add it first
  if (inputImagePath) {
    const imageBuffer = await readFile(inputImagePath);
    const base64Image = imageBuffer.toString("base64");
    const mimeType = inputImagePath.endsWith(".png") ? "image/png" : "image/jpeg";
    parts.push({
      inlineData: {
        mimeType,
        data: base64Image,
      },
    });
  }

  // Add text prompt
  parts.push({ text: prompt });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts,
          },
        ],
        generationConfig: {
          responseModalities: ["IMAGE"],
          imageConfig: {
            aspectRatio,
            imageSize: outputSize,
          },
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API request failed: ${response.status} - ${error}`);
  }

  const data = await response.json();

  // Extract image from the generateContent response.
  const responseParts = data.candidates?.[0]?.content?.parts;
  if (!responseParts) {
    throw new Error("No content in response");
  }

  for (const part of responseParts) {
    if (part.inlineData?.data) {
      const base64Data = part.inlineData.data;
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    }
  }

  throw new Error("No image generated in response");
}

async function main() {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      output: { type: "string", short: "o", default: "./output.png" },
      input: { type: "string", short: "i" },
      model: { type: "string", short: "m", default: "nano-banana-pro" },
      width: { type: "string", short: "w", default: "512" },
      height: { type: "string", short: "h", default: "512" },
      transparent: { type: "boolean", short: "t", default: false },
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
  -o, --output <path>     Output file path (default: ./output.png)
  -i, --input <path>      Input image for image-to-image editing
  -m, --model <model>     Model: nano-banana-pro (default, best quality) or nano-banana-2 (faster)
  -w, --width <px>        Image width (default: 512)
  -h, --height <px>       Image height (default: 512)
  -t, --transparent       Request transparent PNG background
  -s, --style <desc>      Add style modifier to prompt
      --help              Show this help

Examples:
  bun run generate.ts "Art Deco city logo" --output ./logo.png --transparent
  bun run generate.ts "CITY TYCOON title" --width 800 --height 200
  bun run generate.ts "game icon" --model nano-banana-2 --transparent
  bun run generate.ts "add flowers to grass" --input ./grass.png --output ./grass_flowers.png
`);
    process.exit(0);
  }

  // Get prompt from positional args
  const userPrompt = positionals.join(" ");

  // Map friendly names to model IDs
  const modelMap: Record<string, string> = {
    "nano-banana-pro": "gemini-3-pro-image",
    "nano-banana-2": "gemini-3.1-flash-image",
  };

  const modelName = values.model || "nano-banana-pro";
  const modelId = modelMap[modelName];

  if (!modelId) {
    console.error(
      `Unknown model: ${modelName}. Use 'nano-banana-pro' or 'nano-banana-2'`
    );
    process.exit(1);
  }

  const width = parseInt(values.width || "512", 10);
  const height = parseInt(values.height || "512", 10);

  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    console.error("Width and height must be positive integers");
    process.exit(1);
  }

  // Build full prompt
  let prompt = userPrompt;

  if (values.style) {
    prompt = `${prompt}. Style: ${values.style}`;
  }

  if (values.transparent) {
    prompt = `${prompt}\n\nCritical: Transparent PNG background. No background color - the image should have alpha transparency.`;
  }

  const outputPath = values.output || "./output.png";

  console.log(`Generating image...`);
  console.log(`Prompt: ${userPrompt}`);
  console.log(`Model: ${modelName}`);
  console.log(
    `Requested size: ${width}x${height} (API: ${nearestAspectRatio(width, height)}, ${imageSize(width, height, modelId)})`
  );
  console.log(`Output: ${outputPath}`);

  if (values.input) {
    console.log(`Input: ${values.input}`);
  }

  if (values.transparent) {
    console.log(`Background: transparent`);
  }

  try {
    const imageData = await generateImage(prompt, modelId, width, height, values.input);

    // Ensure output directory exists
    await mkdir(dirname(outputPath), { recursive: true });

    // Save to file
    await writeFile(outputPath, Buffer.from(imageData));

    console.log(`\n✓ Image saved to: ${outputPath}`);
  } catch (error) {
    console.error(`\n✗ Error: ${error}`);
    process.exit(1);
  }
}

main();
