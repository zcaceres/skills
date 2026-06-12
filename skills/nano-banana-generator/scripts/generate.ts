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

  const fullPrompt = `${prompt}\n\nImage dimensions: ${width}x${height} pixels.`;

  // Build request parts
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

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
  parts.push({ text: fullPrompt });

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
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API request failed: ${response.status} - ${error}`);
  }

  const data = await response.json();

  // Extract image from response
  const responseParts = data.candidates?.[0]?.content?.parts;
  if (!responseParts) {
    throw new Error("No content in response");
  }

  for (const part of responseParts) {
    if (part.inlineData?.data) {
      // Decode base64 image data
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
      model: { type: "string", short: "m", default: "nano-banana" },
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
  -m, --model <model>     Model: nano-banana (default) or nano-banana-pro
  -w, --width <px>        Image width (default: 512)
  -h, --height <px>       Image height (default: 512)
  -t, --transparent       Request transparent PNG background
  -s, --style <desc>      Add style modifier to prompt
      --help              Show this help

Examples:
  bun run generate.ts "Art Deco city logo" --output ./logo.png --transparent
  bun run generate.ts "CITY TYCOON title" --width 800 --height 200
  bun run generate.ts "game icon" --model nano-banana-pro --transparent
  bun run generate.ts "add flowers to grass" --input ./grass.png --output ./grass_flowers.png
`);
    process.exit(0);
  }

  // Get prompt from positional args
  const userPrompt = positionals.join(" ");

  // Map friendly names to model IDs
  const modelMap: Record<string, string> = {
    "nano-banana": "gemini-2.5-flash-image",
    "nano-banana-pro": "gemini-3-pro-image-preview",
  };

  const modelName = values.model || "nano-banana";
  const modelId = modelMap[modelName];

  if (!modelId) {
    console.error(
      `Unknown model: ${modelName}. Use 'nano-banana' or 'nano-banana-pro'`
    );
    process.exit(1);
  }

  const width = parseInt(values.width || "512", 10);
  const height = parseInt(values.height || "512", 10);

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
  console.log(`Size: ${width}x${height}`);
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
