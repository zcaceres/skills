import { extname, join } from "node:path";

export type ImageFormat = "jpeg" | "png" | "webp";

export function imageFormat(bytes: Uint8Array): ImageFormat {
  // Encoded bytes, not API metadata or a filename, determine the source format.
  const data = Buffer.from(bytes);
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "png";
  }
  if (data.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
    return "jpeg";
  }
  if (data.subarray(0, 4).equals(Buffer.from("RIFF")) && data.subarray(8, 12).equals(Buffer.from("WEBP"))) {
    return "webp";
  }
  throw new Error("Unrecognized generated image format; refusing to save mislabeled output");
}

async function runConverter(format: ImageFormat | "--check", input?: Uint8Array): Promise<Buffer> {
  const directory = join(import.meta.dir, "converter");
  const child = Bun.spawn([
    process.execPath, "--no-install", join(directory, "convert.ts"), format,
  ], {
    cwd: directory,
    stdin: input ? new Blob([Uint8Array.from(input)]) : "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const [code, bytes, stderr] = await Promise.all([
    child.exited, new Response(child.stdout).arrayBuffer(), new Response(child.stderr).text(),
  ]);
  if (code !== 0) {
    const setup = join(import.meta.dir, "setup-converter.ts");
    throw new Error(
      `Image converter failed. Before generating, run:\n  bun ${JSON.stringify(setup)}\n${stderr.trim()}`,
    );
  }
  return Buffer.from(bytes);
}

export async function checkImageConverter(): Promise<void> {
  // Child execution explicitly disables Bun auto-install, even for transitive/native modules.
  await runConverter("--check");
}

export async function prepareOutput(path: string) {
  const extension = extname(path).toLowerCase();
  const format = ({ ".jpg": "jpeg", ".jpeg": "jpeg", ".png": "png", ".webp": "webp" } as const)[
    extension as ".jpg" | ".jpeg" | ".png" | ".webp"
  ];
  if (!format) {
    throw new Error("Output path must end in .jpg, .jpeg, .png, or .webp");
  }

  // Every destination can require conversion if the API changes its native encoding.
  // Check the complete decoder/encoder installation before making a paid API call.
  await checkImageConverter();
  return {
    path,
    async encode(imageData: ArrayBuffer): Promise<Buffer> {
      const bytes = Buffer.from(imageData);
      if (imageFormat(bytes) === format) return bytes; // Preserve native bytes.
      const converted = await runConverter(format, bytes);
      if (imageFormat(converted) !== format) {
        throw new Error(`Converter did not produce the requested ${format} encoding`);
      }
      return converted;
    },
  };
}
