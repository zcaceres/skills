import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const skillDir = join(import.meta.dir, "..");
const skill = readFileSync(join(skillDir, "SKILL.md"), "utf8");
const setup = readFileSync(
  join(skillDir, "references", "setup.md"),
  "utf8",
);

describe("nudge activation", () => {
  test("skill installation does not register a frontmatter hook", () => {
    const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/)?.[1];

    expect(frontmatter).toBeDefined();
    expect(frontmatter).not.toMatch(/^hooks:/m);
  });

  test("setup requires an explicit nudge request before running the installer", () => {
    expect(setup).toContain(
      "Run this step only when the user explicitly requested `nudge`",
    );
    expect(setup).toContain(
      "changing only the draft/backend setting must leave the hook unwired",
    );
  });
});
