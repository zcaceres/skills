import { describe, expect, test } from "bun:test";
import sharp from "sharp";
import { imageFormat, prepareOutput } from "../scripts/image-output";
import converterPackage from "../scripts/converter/package.json";
import skillPackage from "../package.json";
import { JPEG, PNG_BYTES, WEBP } from "./fixtures";

test("repository and standalone converter manifests pin the same Sharp version", () => {
  expect(converterPackage.dependencies.sharp).toBe(skillPackage.dependencies.sharp);
});

describe("encoded format detection", () => {
  test.each([
    [JPEG, "jpeg"],
    [PNG_BYTES, "png"],
    [WEBP, "webp"],
  ] as const)("detects real image signatures", (bytes, expected) => {
    expect(imageFormat(bytes)).toBe(expected);
  });

  test.each([
    Buffer.alloc(0),
    Buffer.from([0xff, 0xd8]),
    Buffer.from("not an image"),
    Buffer.from("RIFF\x04\x00\x00\x00WAVE", "binary"),
  ])("rejects unrecognized image data", (bytes) => {
    expect(() => imageFormat(bytes)).toThrow("Unrecognized generated image format");
  });
});

describe("output encoding", () => {
  for (const [source, bytes] of [["jpeg", JPEG], ["png", PNG_BYTES], ["webp", WEBP]] as const) {
    test.each(["jpeg", "png", "webp"] as const)(`${source} to %s honors the destination format`, async (target) => {
      const path = `assets/logo.${target}`;
      const output = await prepareOutput(path);
      const encoded = await output.encode(Uint8Array.from(bytes).buffer);
      expect(output.path).toBe(path);
      expect(imageFormat(encoded)).toBe(target);
      const metadata = await sharp(encoded).metadata();
      expect(metadata.format).toBe(target);
      expect([metadata.width, metadata.height]).toEqual([3, 2]);
      // Decode the entire output, not just the header.
      const decoded = await sharp(encoded).raw().toBuffer();
      expect(decoded.length).toBe(3 * 2 * 3);
      if (target === source) expect(encoded).toEqual(bytes); // No native recompression.
      if (target === "png") {
        expect(decoded).toEqual(await sharp(bytes).raw().toBuffer()); // Lossless conversion.
      }
    });
  }

  test.each(["output.jpg", "output.jpeg", "output.JPG", "output.JPEG", "output.PNG", "output.webp"])(
    "preserves the exact requested path %s",
    async (path) => expect((await prepareOutput(path)).path).toBe(path),
  );

  test.each(["output", "output.gif", "output.svg"])("rejects unsupported destination %s", async (path) => {
    await expect(prepareOutput(path)).rejects.toThrow("Output path must end in");
  });

  test("rejects invalid source bytes before conversion", async () => {
    await expect((await prepareOutput("output.png")).encode(Uint8Array.from([1, 2, 3]).buffer))
      .rejects.toThrow("Unrecognized generated image format");
  });
});
