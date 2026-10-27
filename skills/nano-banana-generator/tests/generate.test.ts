import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { join } from "path";
import sharp from "sharp";
import { generateImage, imageSize, main, MODEL_MAP } from "../scripts/generate";
import { PNG, PNG_BYTES, JPEG, WEBP, completed, jpegResponse } from "./fixtures";

describe("model selection", () => {
  test("keeps Pro and updates both fast model names to Nano Banana 2.1", () => {
    expect(MODEL_MAP["nano-banana-pro"]).toBe("gemini-3-pro-image");
    expect(MODEL_MAP["nano-banana-2.1"]).toBe("gemini-nano-banana-2.1");
    expect(MODEL_MAP["nano-banana-2"]).toBe("gemini-nano-banana-2.1");
  });
});

describe("output resolution", () => {
  test.each([
    [256, 256, "1K"],
    [512, 512, "1K"],
    [1024, 1024, "1K"],
    [1025, 512, "2K"],
    [512, 2048, "2K"],
    [2049, 512, "4K"],
    [512, 4096, "4K"],
  ] as const)("%ix%i maps to %s", (width, height, expected) => {
    expect(imageSize(width, height)).toBe(expected);
  });
});

describe("Interactions API", () => {
  let directory: string;
  let originalKey: string | undefined;
  let fetchMock: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;

  beforeEach(async () => {
    originalKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "test-only-key";
    directory = await mkdtemp(join(process.env.DELTA_SCRATCH_DIR ?? import.meta.dir, ".nano-banana-test-"));
    fetchMock = spyOn(globalThis, "fetch").mockResolvedValue(Response.json(completed));
    spyOn(console, "log").mockImplementation(() => {});
    spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(async () => {
    mock.restore();
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
    await rm(directory, { recursive: true, force: true });
  });

  function request() {
    const [url, init] = fetchMock.mock.calls[0];
    return { url, init, body: JSON.parse(init!.body as string) };
  }

  test("uses typed inputs, image response format, and explicit stateless storage", async () => {
    const result = await generateImage("A banana", MODEL_MAP["nano-banana-2.1"], 512, 512);
    expect(Buffer.from(result)).toEqual(Buffer.from(PNG, "base64"));
    const { url, init, body } = request();
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/interactions");
    expect(init!.method).toBe("POST");
    expect(init!.headers).toEqual({
      "Content-Type": "application/json",
      "x-goog-api-key": "test-only-key",
    });
    expect(body).toEqual({
      model: "gemini-nano-banana-2.1",
      input: [{ type: "text", text: "A banana" }],
      store: false,
      response_format: { type: "image", aspect_ratio: "1:1", image_size: "1K" },
    });
  });

  test.each([
    [1024, 1024, "1K", "1:1"],
    [2048, 2048, "2K", "1:1"],
    [4096, 4096, "4K", "1:1"],
    [800, 200, "1K", "4:1"],
  ] as const)("sends %ix%i as %s, %s", async (width, height, size, ratio) => {
    await generateImage("A banana", MODEL_MAP["nano-banana-2.1"], width, height);
    expect(request().body.response_format).toEqual({
      type: "image", aspect_ratio: ratio, image_size: size,
    });
  });

  test.each([
    ["png", PNG_BYTES, "image/png"],
    ["jpg", JPEG, "image/jpeg"],
    ["webp", WEBP, "image/webp"],
    ["jpg", PNG_BYTES, "image/png"], // Filename does not override the encoded format.
  ] as const)("uploads %s editing input using Interactions content blocks", async (extension, bytes, mimeType) => {
    const path = join(directory, `input.${extension}`);
    await writeFile(path, bytes);
    await generateImage("Add flowers", MODEL_MAP["nano-banana-pro"], 1024, 1024, path);
    expect(request().body.input).toEqual([
      { type: "image", mime_type: mimeType, data: bytes.toString("base64") },
      { type: "text", text: "Add flowers" },
    ]);
  });

  test.each([
    [[], "gemini-3-pro-image"],
    [["--model", "nano-banana-2.1"], "gemini-nano-banana-2.1"],
    [["--model", "nano-banana-2"], "gemini-nano-banana-2.1"],
  ] as const)("CLI model options %j select %s and save the image", async (options, model) => {
    const output = join(directory, "nested", "output.png");
    await main(["A banana", ...options, "--output", output, "--style", "Art Deco"]);
    expect(request().body.model).toBe(model);
    expect(request().body.input[0].text).toContain("A banana. Style: Art Deco");
    expect(request().body.input[0].text).toBe("A banana. Style: Art Deco");
    expect(await readFile(output)).toEqual(Buffer.from(PNG, "base64"));
  });

  test("converts a JPEG response to a valid PNG at the exact requested path", async () => {
    fetchMock.mockResolvedValue(Response.json(jpegResponse));
    const requested = join(directory, "output.png");
    await main(["A banana", "--output", requested]);
    const saved = await readFile(requested);
    expect((await sharp(saved).metadata()).format).toBe("png");
    expect(await sharp(saved).raw().toBuffer()).toEqual(await sharp(JPEG).raw().toBuffer());
    expect(await Bun.file(join(directory, "output.jpg")).exists()).toBe(false);
    expect(console.log).toHaveBeenCalledWith(`\n✓ Image saved to: ${requested}`);
    expect(request().body.response_format).not.toHaveProperty("mime_type");
  });

  test("does not rename a PNG destination or touch a JPEG sibling", async () => {
    fetchMock.mockResolvedValue(Response.json(jpegResponse));
    const requested = join(directory, "output.png");
    const sibling = join(directory, "output.jpg");
    await writeFile(sibling, "existing image");
    await main(["A banana", "--output", requested]);
    expect(await readFile(sibling, "utf8")).toBe("existing image");
    expect((await sharp(await readFile(requested)).metadata()).format).toBe("png");
  });

  test.each(["--transparent", "-t"])("rejects removed flag %s before calling Gemini", async (flag) => {
    await expect(main(["A banana", flag])).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("rejects unsupported output extensions before calling Gemini", async () => {
    await expect(main(["A banana", "--output", join(directory, "output.gif")]))
      .rejects.toThrow("Output path must end in");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("conversion failure does not overwrite the destination", async () => {
    fetchMock.mockResolvedValue(Response.json({
      status: "completed",
      steps: [{ type: "model_output", content: [{ type: "image", data: "/9j/4AAE" }] }],
    }));
    const output = join(directory, "output.png");
    await writeFile(output, "existing image");
    await expect(main(["A banana", "--output", output])).rejects.toThrow();
    expect(await readFile(output, "utf8")).toBe("existing image");
  });

  test("runs the Bun CLI end to end with a mocked HTTP transport", async () => {
    const preload = join(directory, "mock-fetch.ts");
    const captured = join(directory, "request.json");
    const output = join(directory, "cli-output.png");
    await writeFile(preload, `
      import { writeFileSync } from "fs";
      globalThis.fetch = async (url, init) => {
        writeFileSync(${JSON.stringify(captured)}, JSON.stringify({ url, body: JSON.parse(init.body) }));
        return Response.json(${JSON.stringify(completed)});
      };
    `);
    const child = Bun.spawn([
      process.execPath, "--preload", preload,
      join(import.meta.dir, "../scripts/generate.ts"),
      "A banana", "--model", "nano-banana-2.1", "--output", output,
    ], {
      env: { ...process.env, GEMINI_API_KEY: "test-only-key" },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [code, stdout, stderr] = await Promise.all([
      child.exited, new Response(child.stdout).text(), new Response(child.stderr).text(),
    ]);
    expect(code).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toContain("Image saved to:");
    expect(await readFile(output)).toEqual(Buffer.from(PNG, "base64"));
    expect(JSON.parse(await readFile(captured, "utf8"))).toMatchObject({
      url: "https://generativelanguage.googleapis.com/v1beta/interactions",
      body: { model: "gemini-nano-banana-2.1", store: false },
    });
  });

  test("rejects missing credentials without sending a request", async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(generateImage("A banana", MODEL_MAP["nano-banana-pro"], 512, 512))
      .rejects.toThrow("GEMINI_API_KEY environment variable not set");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("surfaces HTTP API errors", async () => {
    fetchMock.mockResolvedValue(new Response("quota exceeded", { status: 429 }));
    await expect(generateImage("A banana", MODEL_MAP["nano-banana-pro"], 512, 512))
      .rejects.toThrow("API request failed: 429 - quota exceeded");
  });

  test.each(["failed", "cancelled", "incomplete", "in_progress", "requires_action", undefined])(
    "does not save partial output when status is %s",
    async (status) => {
      fetchMock.mockResolvedValue(Response.json({ ...completed, status }));
      await expect(generateImage("A banana", MODEL_MAP["nano-banana-pro"], 512, 512))
        .rejects.toThrow(`Image generation did not complete (status: ${status ?? "missing"})`);
    },
  );

  test.each([
    { status: "completed" },
    { status: "completed", steps: [] },
    { status: "completed", steps: [{ type: "model_output", content: [{ type: "text", text: "Blocked" }] }] },
    { status: "completed", steps: [{ type: "thought", content: [{ type: "image", data: PNG }] }] },
  ])("rejects a completed response without an output image: %j", async (response) => {
    fetchMock.mockResolvedValue(Response.json(response));
    await expect(generateImage("A banana", MODEL_MAP["nano-banana-pro"], 512, 512))
      .rejects.toThrow("No image generated in response");
  });
});
