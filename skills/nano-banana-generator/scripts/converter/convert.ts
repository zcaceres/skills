import sharp from "sharp";
import manifest from "./package.json";

async function main() {
  if (sharp.versions.sharp !== manifest.dependencies.sharp) {
    throw new Error(`Expected Sharp ${manifest.dependencies.sharp}, found ${sharp.versions.sharp}`);
  }
  for (const format of ["jpeg", "png", "webp"] as const) {
    if (!sharp.format[format].input.buffer || !sharp.format[format].output.buffer) {
      throw new Error(`Sharp cannot decode/encode ${format} on this installation`);
    }
  }
  const format = Bun.argv[2];
  if (format === "--check") return;
  if (format !== "jpeg" && format !== "png" && format !== "webp") {
    throw new Error("Expected jpeg, png, webp, or --check");
  }
  const input = Buffer.from(await Bun.stdin.arrayBuffer());
  const output = await sharp(input).toFormat(format).toBuffer();
  await Bun.write(Bun.stdout, output);
}

main().catch((error) => {
  console.error(String(error));
  process.exitCode = 1;
});
