import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("Git stack workflow documentation", () => {
  test("defines the linear stack and safe update invariants", () => {
    const skill = read("SKILL.md");
    const update = read("references/git/update.md");

    expect(skill).toContain("Treat a stack as one linear history");
    expect(skill).toContain("gh stack rebase --upstack");
    expect(skill).toContain("gh stack push");
    expect(update).toContain("lowest layer where the change logically belongs");
    expect(update).toContain("gh stack checkout <owning-branch>");
    expect(update).toContain("gh stack rebase --upstack");
  });

  test("uses stack-aware synchronization and conflict recovery", () => {
    const sync = read("references/git/sync.md");
    const recovery = read("references/recovery.md");

    expect(sync).toContain("bottom layer onto updated trunk");
    expect(sync).toContain("gh stack sync --prune");
    expect(recovery).toContain("gh stack rebase --continue");
    expect(recovery).toContain("gh stack rebase --abort");
    expect(recovery).not.toContain("git rebase --continue");
  });

  test("publishes only after restacking changed ancestry", () => {
    const submit = read("references/git/submit.md");

    expect(submit).toContain("publication operation, not a repair operation");
    expect(submit).toContain("gh stack rebase --upstack");
    expect(submit).toContain("gh stack push");
  });

  test("merges and prunes through gh stack", () => {
    const merge = read("references/git/merge.md");

    expect(merge).toContain("gh stack merge --yes --rebase");
    expect(merge).toContain("gh stack sync --prune");
    expect(merge).not.toContain("merge-async");
    expect(merge).not.toMatch(/^\s*gh pr merge/m);
  });
});
