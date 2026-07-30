import { afterEach, describe, expect, test } from "bun:test";
import { join, sep } from "path";

import {
  buildNudgeMessage,
  globToRegex,
  hookHostFor,
  isExcluded,
  shouldFire,
  stateFileFor,
} from "../scripts/index";

describe("globToRegex", () => {
  test("escapes literal dots", () => {
    const re = globToRegex("bun.lock");
    expect(re.test("bun.lock")).toBe(true);
    expect(re.test("bunXlock")).toBe(false);
  });

  test("unanchored * matches anywhere in basename", () => {
    const re = globToRegex("*.lock");
    expect(re.test("bun.lock")).toBe(true);
    expect(re.test("Cargo.lock")).toBe(true);
    expect(re.test("lock")).toBe(false);
  });

  test("anchored ** crosses path separators", () => {
    const re = globToRegex("dist/**");
    expect(re.test("dist/index.js")).toBe(true);
    expect(re.test("dist/sub/nested.js")).toBe(true);
    expect(re.test("src/dist/x.js")).toBe(false);
  });

  test("anchored single * does not cross /", () => {
    const re = globToRegex("dist/*.js");
    expect(re.test("dist/index.js")).toBe(true);
    expect(re.test("dist/sub/index.js")).toBe(false);
  });
});

describe("isExcluded", () => {
  test("default lockfile excluded by basename", () => {
    expect(isExcluded("bun.lock")).toBe(true);
    expect(isExcluded("packages/foo/bun.lock")).toBe(true);
  });

  test("default dist/** excluded only at path root", () => {
    expect(isExcluded("dist/index.js")).toBe(true);
    expect(isExcluded("dist/nested/index.js")).toBe(true);
  });

  test("normal source files not excluded", () => {
    expect(isExcluded("src/pr-nudge.ts")).toBe(false);
    expect(isExcluded("install.ts")).toBe(false);
    expect(isExcluded("README.md")).toBe(false);
  });

  test("minified assets excluded by basename", () => {
    expect(isExcluded("public/app.min.js")).toBe(true);
    expect(isExcluded("public/app.min.css")).toBe(true);
  });
});

describe("shouldFire", () => {
  test("fires when no prior entry exists", () => {
    expect(shouldFire(undefined, { lines: 400, files: 9 })).toBe(true);
  });

  test("suppresses while inside cooldown and below re-arm deltas", () => {
    const recent = {
      lastFireAt: Date.now() - 60_000,
      lastFireLines: 400,
      lastFireFiles: 9,
    };
    expect(shouldFire(recent, { lines: 410, files: 9 })).toBe(false);
  });

  test("re-fires once cooldown window elapses", () => {
    const stale = {
      lastFireAt: Date.now() - 60 * 60 * 1000,
      lastFireLines: 400,
      lastFireFiles: 9,
    };
    expect(shouldFire(stale, { lines: 410, files: 9 })).toBe(true);
  });

  test("re-fires when lines grow past delta threshold", () => {
    const recent = {
      lastFireAt: Date.now() - 60_000,
      lastFireLines: 400,
      lastFireFiles: 9,
    };
    expect(shouldFire(recent, { lines: 600, files: 9 })).toBe(true);
  });

  test("re-fires when file count grows past delta threshold", () => {
    const recent = {
      lastFireAt: Date.now() - 60_000,
      lastFireLines: 400,
      lastFireFiles: 9,
    };
    expect(shouldFire(recent, { lines: 410, files: 13 })).toBe(true);
  });
});

describe("buildNudgeMessage", () => {
  test("includes line and file counts and the /pr pointer", () => {
    const msg = buildNudgeMessage(321, 9);
    expect(msg).toContain("321 lines");
    expect(msg).toContain("9 files");
    expect(msg).toContain("/pr");
  });

  test("uses Codex skill invocation syntax for Codex hooks", () => {
    const msg = buildNudgeMessage(321, 9, "codex");
    expect(msg).toContain("$pr");
    expect(msg).not.toContain("/pr");
  });
});

describe("hookHostFor", () => {
  test("distinguishes hosts without changing Claude and Gemini detection", () => {
    expect(hookHostFor({})).toBe("claude");
    expect(hookHostFor({ hook_event_name: "AfterTool" })).toBe("gemini");
    expect(
      hookHostFor({
        hook_event_name: "PostToolUse",
        turn_id: "turn_123",
        model: "gpt-5",
      }),
    ).toBe("codex");
  });
});

describe("stateFileFor", () => {
  const prev = process.env.PR_NUDGE_STATE_DIR;
  afterEach(() => {
    if (prev === undefined) delete process.env.PR_NUDGE_STATE_DIR;
    else process.env.PR_NUDGE_STATE_DIR = prev;
  });

  test("Gemini's AfterTool homes state under ~/.gemini", () => {
    delete process.env.PR_NUDGE_STATE_DIR;
    const p = stateFileFor("gemini");
    expect(p).toContain(`${sep}.gemini${sep}state${sep}`);
    expect(p.endsWith("pr-nudge.json")).toBe(true);
  });

  test("Claude Code (no event name, or PostToolUse) homes state under ~/.claude", () => {
    delete process.env.PR_NUDGE_STATE_DIR;
    expect(stateFileFor("claude")).toContain(`${sep}.claude${sep}state${sep}`);
  });

  test("Codex homes state under ~/.codex", () => {
    delete process.env.PR_NUDGE_STATE_DIR;
    expect(stateFileFor("codex")).toContain(`${sep}.codex${sep}state${sep}`);
  });

  test("PR_NUDGE_STATE_DIR overrides the host default", () => {
    process.env.PR_NUDGE_STATE_DIR = join(sep, "tmp", "nudge-state");
    expect(stateFileFor("gemini")).toBe(
      join(sep, "tmp", "nudge-state", "pr-nudge.json"),
    );
  });
});
