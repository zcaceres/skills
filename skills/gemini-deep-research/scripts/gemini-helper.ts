#!/usr/bin/env bun
/**
 * Gemini Deep Research Helper
 *
 * Commands:
 *   submit "<query>"  - Submit research request, returns interaction ID
 *   poll <id>         - Start background polling (checks every 60s, caches result when done)
 *   check <id>        - Check if research is complete (uses cache)
 *   result <id>       - Get the final report (uses cache)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, "config.txt");
const CACHE_DIR = join(__dirname, ".cache");
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const AGENT = "deep-research-pro-preview-12-2025";
const POLL_INTERVAL_MS = 60_000; // 1 minute

interface Interaction {
  id: string;
  status: "in_progress" | "completed" | "failed";
  outputs?: Array<{ text: string }>;
  error?: { message: string };
}

interface CachedResult {
  id: string;
  status: "completed" | "failed";
  report?: string;
  error?: string;
  completedAt: string;
}

function ensureCacheDir(): void {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function getCachePath(id: string): string {
  return join(CACHE_DIR, `${id}.json`);
}

function getCachedResult(id: string): CachedResult | null {
  const cachePath = getCachePath(id);
  if (existsSync(cachePath)) {
    return JSON.parse(readFileSync(cachePath, "utf-8"));
  }
  return null;
}

function cacheResult(result: CachedResult): void {
  ensureCacheDir();
  writeFileSync(getCachePath(result.id), JSON.stringify(result, null, 2));
}

function getApiKey(): string {
  const envKey = process.env.GEMINI_API_KEY;
  if (envKey) {
    return envKey;
  }

  if (existsSync(CONFIG_PATH)) {
    const content = readFileSync(CONFIG_PATH, "utf-8");
    const match = content.match(/GEMINI_API_KEY=(.+)/);
    if (match?.[1] && match[1] !== "your-api-key-here") {
      return match[1].trim();
    }
  }

  console.error("Error: GEMINI_API_KEY not found");
  console.error("Set GEMINI_API_KEY environment variable or add it to config.txt");
  process.exit(1);
}

async function fetchInteraction(interactionId: string): Promise<Interaction> {
  const apiKey = getApiKey();
  const response = await fetch(`${BASE_URL}/interactions/${interactionId}`, {
    method: "GET",
    headers: { "x-goog-api-key": apiKey },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${await response.text()}`);
  }

  return response.json() as Promise<Interaction>;
}

async function submit(query: string): Promise<void> {
  const apiKey = getApiKey();

  const response = await fetch(`${BASE_URL}/interactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      input: query,
      agent: AGENT,
      background: true,
      stream: false,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`Error submitting research: ${response.status}`);
    console.error(error);
    process.exit(1);
  }

  const data = (await response.json()) as Interaction;
  console.log(JSON.stringify({ id: data.id, status: data.status }));
}

async function pollBackground(interactionId: string): Promise<void> {
  // Spawn detached process to poll in background
  const child = spawn(
    "bun",
    [join(__dirname, "gemini-helper.ts"), "_poll_loop", interactionId],
    {
      detached: true,
      stdio: "ignore",
      env: { ...process.env },
    }
  );
  child.unref();
  console.log(JSON.stringify({ id: interactionId, polling: true, message: "Background polling started" }));
}

async function pollLoop(interactionId: string): Promise<void> {
  // Internal command - runs the actual polling loop
  const maxAttempts = 15; // 15 minutes max
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const data = await fetchInteraction(interactionId);

      if (data.status === "completed") {
        const report = data.outputs?.[data.outputs.length - 1]?.text || "";
        cacheResult({
          id: interactionId,
          status: "completed",
          report,
          completedAt: new Date().toISOString(),
        });
        return;
      }

      if (data.status === "failed") {
        cacheResult({
          id: interactionId,
          status: "failed",
          error: data.error?.message || "Unknown error",
          completedAt: new Date().toISOString(),
        });
        return;
      }

      // Still in progress, wait and retry
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    } catch (error) {
      // On error, wait and retry
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }

  // Timed out
  cacheResult({
    id: interactionId,
    status: "failed",
    error: "Polling timed out after 15 minutes",
    completedAt: new Date().toISOString(),
  });
}

async function check(interactionId: string): Promise<void> {
  // First check cache
  const cached = getCachedResult(interactionId);
  if (cached) {
    console.log(JSON.stringify({ id: interactionId, status: cached.status, cached: true }));
    return;
  }

  // Not in cache, check API
  try {
    const data = await fetchInteraction(interactionId);
    console.log(JSON.stringify({ id: data.id, status: data.status, cached: false }));
  } catch (error) {
    console.error(`Error checking status: ${error}`);
    process.exit(1);
  }
}

async function result(interactionId: string): Promise<void> {
  // First check cache
  const cached = getCachedResult(interactionId);
  if (cached) {
    if (cached.status === "failed") {
      console.error(`Research failed: ${cached.error}`);
      process.exit(1);
    }
    console.log(cached.report);
    return;
  }

  // Not in cache, fetch from API
  try {
    const data = await fetchInteraction(interactionId);

    if (data.status === "failed") {
      console.error(`Research failed: ${data.error?.message || "Unknown error"}`);
      process.exit(1);
    }

    if (data.status !== "completed") {
      console.error(`Research not complete. Status: ${data.status}`);
      process.exit(1);
    }

    const report = data.outputs?.[data.outputs.length - 1]?.text || "";

    // Cache for future use
    cacheResult({
      id: interactionId,
      status: "completed",
      report,
      completedAt: new Date().toISOString(),
    });

    console.log(report);
  } catch (error) {
    console.error(`Error getting result: ${error}`);
    process.exit(1);
  }
}

// CLI
const [command, ...args] = process.argv.slice(2);

switch (command) {
  case "submit":
    if (!args[0]) {
      console.error('Usage: bun gemini-helper.ts submit "<query>"');
      process.exit(1);
    }
    await submit(args.join(" "));
    break;

  case "poll":
    if (!args[0]) {
      console.error("Usage: bun gemini-helper.ts poll <interaction-id>");
      process.exit(1);
    }
    await pollBackground(args[0]);
    break;

  case "_poll_loop":
    // Internal command for background polling
    if (!args[0]) process.exit(1);
    await pollLoop(args[0]);
    break;

  case "check":
    if (!args[0]) {
      console.error("Usage: bun gemini-helper.ts check <interaction-id>");
      process.exit(1);
    }
    await check(args[0]);
    break;

  case "result":
    if (!args[0]) {
      console.error("Usage: bun gemini-helper.ts result <interaction-id>");
      process.exit(1);
    }
    await result(args[0]);
    break;

  default:
    console.log("Gemini Deep Research Helper");
    console.log("");
    console.log("Commands:");
    console.log('  submit "<query>"  - Submit a research request');
    console.log("  poll <id>         - Start background polling (every 60s)");
    console.log("  check <id>        - Check if research is complete");
    console.log("  result <id>       - Get the final report");
    process.exit(0);
}
