import { expect, test } from "bun:test";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import sharp from "sharp";
import { JPEG, jpegResponse } from "./fixtures";

test("shipped skill preflights missing dependencies, installs portably, and honors output formats", async () => {
  const root = resolve(import.meta.dir, "../../..");
  const temporary = await mkdtemp(join(process.env.DELTA_SCRATCH_DIR ?? tmpdir(), "nano-banana-install-"));
  async function run(args: string[], cwd = temporary) {
    const child = Bun.spawn([process.execPath, ...args], {
      cwd,
      env: { ...process.env, GEMINI_API_KEY: "test-only-key", NODE_PATH: "" },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [code, stdout, stderr] = await Promise.all([
      child.exited, new Response(child.stdout).text(), new Response(child.stderr).text(),
    ]);
    return { code, stdout, stderr };
  }

  try {
    const build = await run(["run", "build", "nano-banana-generator"], root);
    expect(build.code, build.stderr).toBe(0);
    const install = join(temporary, "installed skill");
    await cp(join(root, "skills/nano-banana-generator/dist/nano-banana-generator"), install, { recursive: true });
    const scripts = join(install, "scripts");
    expect(await Bun.file(join(scripts, "converter/package.json")).exists()).toBe(true);
    expect(await Bun.file(join(scripts, "converter/bun.lock")).exists()).toBe(true);
    // The build machine has this package; the artifact must not ship its native modules.
    expect(await Bun.file(join(scripts, "converter/node_modules/sharp/package.json")).exists()).toBe(false);

    const captured = join(temporary, "paid-request.json");
    const preload = join(temporary, "mock-fetch.ts");
    await writeFile(preload, `
      import { writeFileSync } from "node:fs";
      globalThis.fetch = async (url, init) => {
        writeFileSync(${JSON.stringify(captured)}, JSON.stringify({ url, body: JSON.parse(init.body) }));
        return Response.json(${JSON.stringify(jpegResponse)});
      };
    `);
    const command = ["--preload", preload, join(scripts, "generate.ts"), "A banana"];
    for (const extension of ["jpg", "png"]) {
      const missing = await run([...command, "--output", `missing.${extension}`]);
      expect(missing.code).toBe(1);
      expect(missing.stderr).toContain("setup-converter.ts");
      expect(await Bun.file(captured).exists()).toBe(false);
      expect(await Bun.file(join(temporary, `missing.${extension}`)).exists()).toBe(false);
    }

    for (const flag of ["--transparent", "-t"]) {
      const removed = await run([...command, flag]);
      expect(removed.code).toBe(1);
      expect(removed.stderr).toContain("Unknown option");
      expect(await Bun.file(captured).exists()).toBe(false);
    }

    // All packages are already cached by the repository's frozen-lockfile install.
    // This proves installed copies can provision without using the repo's node_modules.
    const setup = await run([join(scripts, "setup-converter.ts"), "--offline"]);
    expect(setup.code, setup.stderr).toBe(0);
    expect(setup.stdout).toContain("Image converter ready");

    const native = await run(command); // No --output: output.jpg, native bytes unchanged.
    expect(native.code, native.stderr).toBe(0);
    expect(await readFile(join(temporary, "output.jpg"))).toEqual(JPEG);
    for (const extension of ["png", "webp"] as const) {
      const output = join(temporary, `explicit.${extension}`);
      const converted = await run([...command, "--output", output]);
      expect(converted.code, converted.stderr).toBe(0);
      expect(converted.stdout).toContain(`Image saved to: ${output}`);
      const encoded = await readFile(output);
      expect((await sharp(encoded).metadata()).format).toBe(extension);
      expect((await sharp(encoded).raw().toBuffer()).length).toBe(18);
    }
    const request = JSON.parse(await readFile(captured, "utf8"));
    expect(request.body.response_format).not.toHaveProperty("mime_type");
    expect(request.body.store).toBe(false);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}, 30_000);
