#!/usr/bin/env bun
import { join } from "node:path";
import { checkImageConverter } from "./image-output";

const directory = join(import.meta.dir, "converter");
const install = Bun.spawn([
  process.execPath, "install", "--cwd", directory, "--frozen-lockfile", "--ignore-scripts",
  ...(Bun.argv.includes("--offline") ? ["--offline"] : []),
], { stdin: "ignore", stdout: "inherit", stderr: "inherit" });
const code = await install.exited;
if (code !== 0) {
  console.error("Converter installation failed; no Gemini request was made.");
  process.exit(code);
}
await checkImageConverter();
console.log("Image converter ready (JPEG, PNG, WebP).");
