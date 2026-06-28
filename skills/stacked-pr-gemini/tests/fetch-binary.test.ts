import { describe, expect, test } from "bun:test";
import { chmod, cp, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Mirror fetch-binary.sh's uname -> asset-suffix mapping so the fixture binary
// matches whatever host the test runs on (macOS arm64 locally, linux-x64 in CI).
function hostPlatform(): string | null {
  const arch = process.arch; // 'arm64' | 'x64'
  if (process.platform === "darwin") return arch === "arm64" ? "darwin-arm64" : "darwin-x64";
  if (process.platform === "linux") return arch === "arm64" ? "linux-arm64" : "linux-x64";
  return null;
}

const FETCH = join(import.meta.dir, "..", "scripts", "fetch-binary.sh");

describe("fetch-binary.sh", () => {
  test("is an idempotent no-op when the host binary is already present", async () => {
    const platform = hostPlatform();
    if (!platform) return; // exotic host — nothing to assert

    // Stand up an isolated skill layout: <skill>/scripts/{fetch-binary.sh,bin/}.
    // The script derives skill name + dir from its own location, so this needs
    // no real install — and the present-binary branch exits before ever
    // touching gh or bun, keeping the test hermetic (no network, no build).
    const root = await mkdtemp(join(tmpdir(), "fetchbin-"));
    const scripts = join(root, "demo-skill", "scripts");
    await mkdir(join(scripts, "bin"), { recursive: true });
    await cp(FETCH, join(scripts, "fetch-binary.sh"));

    const binFile = join(scripts, "bin", `demo-skill-nudge-${platform}`);
    await writeFile(binFile, "#!/bin/sh\nexit 0\n");
    await chmod(binFile, 0o755);

    const proc = Bun.spawn(["bash", join(scripts, "fetch-binary.sh")], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exit = await proc.exited;
    const out = await new Response(proc.stdout).text();

    expect(exit).toBe(0);
    expect(out).toContain("already present");
  });
});
