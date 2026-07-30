import { describe, expect, test } from "bun:test";

import {
  assertPullRequestInRepository,
  assertStablePullRequest,
  isStackCandidateFromRepository,
  orderLinearStack,
  renderDiffBlocks,
  renderIndex,
  renderReviewDocument,
  splitPatch,
  type PullRequestSummary,
} from "../scripts/walk";

function pr(
  number: number,
  headRefName: string,
  baseRefName: string,
): PullRequestSummary {
  return {
    number,
    title: `[demo ${number}/3] PR ${number}`,
    url: `https://example.test/pull/${number}`,
    headRefName,
    baseRefName,
    state: "OPEN",
  };
}

describe("orderLinearStack", () => {
  test("orders ancestors, the selected PR, and descendants bottom-to-top", () => {
    const bottom = pr(1, "stack/one", "main");
    const middle = pr(2, "stack/two", "stack/one");
    const top = pr(3, "stack/three", "stack/two");
    const ordered = orderLinearStack(
      middle,
      new Map([
        [middle.number, bottom],
        [bottom.number, undefined],
      ]),
      new Map([
        [middle.number, top],
        [top.number, undefined],
      ]),
    );
    expect(ordered.map((item) => item.number)).toEqual([1, 2, 3]);
  });

  test("rejects cycles", () => {
    const one = pr(1, "one", "two");
    const two = pr(2, "two", "one");
    expect(() =>
      orderLinearStack(
        one,
        new Map([
          [one.number, two],
          [two.number, one],
        ]),
        new Map(),
      )
    ).toThrow("cycle");
  });
});

describe("isStackCandidateFromRepository", () => {
  test("accepts same-repository heads and rejects colliding fork branch names", () => {
    const sameRepository = {
      ...pr(1, "main", "trunk"),
      headRepositoryOwner: { login: "Acme" },
      isCrossRepository: false,
    };
    const forkWithSameBranch = {
      ...pr(2, "main", "trunk"),
      headRepositoryOwner: { login: "contributor" },
      isCrossRepository: true,
    };

    expect(isStackCandidateFromRepository(sameRepository, "acme")).toBe(true);
    expect(isStackCandidateFromRepository(forkWithSameBranch, "acme")).toBe(
      false,
    );
  });
});

describe("assertPullRequestInRepository", () => {
  test("accepts a PR URL from the current repository", () => {
    expect(() =>
      assertPullRequestInRepository(
        "https://github.com/Owner/Repo/pull/123",
        "owner/repo",
      )
    ).not.toThrow();
  });

  test("rejects a PR URL from another repository", () => {
    expect(() =>
      assertPullRequestInRepository(
        "https://github.com/other/project/pull/123",
        "owner/repo",
      )
    ).toThrow("PR URL resolves to other/project");
  });
});

describe("assertStablePullRequest", () => {
  test("accepts an unchanged open PR", () => {
    const expected = {
      ...pr(1, "stack/one", "main"),
      headRefOid: "abc123",
    };
    expect(() => assertStablePullRequest(expected, { ...expected })).not.toThrow();
  });

  test("rejects a PR that merges during packet generation", () => {
    const expected = {
      ...pr(1, "stack/one", "main"),
      headRefOid: "abc123",
    };
    expect(() =>
      assertStablePullRequest(expected, { ...expected, state: "MERGED" })
    ).toThrow("became merged");
  });

  test("rejects head or stack-position drift", () => {
    const expected = {
      ...pr(1, "stack/one", "main"),
      headRefOid: "abc123",
    };
    expect(() =>
      assertStablePullRequest(expected, {
        ...expected,
        headRefOid: "def456",
      })
    ).toThrow("head moved");
    expect(() =>
      assertStablePullRequest(expected, {
        ...expected,
        baseRefName: "release",
      })
    ).toThrow("changed stack position");
  });

  test("rejects base-tip or PR metadata drift", () => {
    const expected = {
      ...pr(1, "stack/one", "main"),
      headRefOid: "head-1",
      baseRefOid: "base-1",
      updatedAt: "2026-01-01T00:00:00Z",
    };
    expect(() =>
      assertStablePullRequest(expected, {
        ...expected,
        baseRefOid: "base-2",
      })
    ).toThrow("base moved");
    expect(() =>
      assertStablePullRequest(expected, {
        ...expected,
        updatedAt: "2026-01-01T00:01:00Z",
      })
    ).toThrow("metadata or discussion changed");
  });
});

describe("splitPatch", () => {
  test("preserves every byte while splitting file sections", () => {
    const patch = [
      "diff --git a/src/a.ts b/src/a.ts\n",
      "--- a/src/a.ts\n",
      "+++ b/src/a.ts\n",
      "@@ -1 +1 @@\n",
      "-old\n",
      "+new\n",
      "diff --git a/src/b.ts b/src/b.ts\n",
      "--- a/src/b.ts\n",
      "+++ b/src/b.ts\n",
      "@@ -0,0 +1 @@\n",
      "+two\n",
    ].join("");
    const sections = splitPatch(patch);
    expect(sections.map((section) => section.path)).toEqual([
      "src/a.ts",
      "src/b.ts",
    ]);
    expect(sections.map((section) => section.content).join("")).toBe(patch);
  });
});

describe("renderDiffBlocks", () => {
  test("renders each diff independently without treating later Markdown as diff content", async () => {
    const markdown = [
      "# Review\n",
      "\n",
      "~~~~diff\n",
      "diff --git a/src/a.ts b/src/a.ts\n",
      "-old\n",
      "+new\n",
      "~~~~\n",
      "\n",
      "## Notes\n",
      "\n",
      "- [ ] keep this as Markdown\n",
      "\n",
      "~~~~~diff\n",
      "diff --git a/src/b.ts b/src/b.ts\n",
      "+second\n",
      "~~~~~\n",
    ].join("");
    const patches: string[] = [];

    const output = await renderDiffBlocks(markdown, async (patch) => {
      patches.push(patch);
      return `<rendered>${patch}</rendered>\n`;
    });

    expect(patches).toEqual([
      "diff --git a/src/a.ts b/src/a.ts\n-old\n+new\n",
      "diff --git a/src/b.ts b/src/b.ts\n+second\n",
    ]);
    expect(output).toContain(
      "<rendered>diff --git a/src/a.ts b/src/a.ts\n-old\n+new\n</rendered>",
    );
    expect(output).toContain("- [ ] keep this as Markdown");
    expect(output).not.toContain("~~~~diff");
    expect(output).not.toContain("~~~~~diff");
  });

  test("rejects an unclosed generated diff fence", async () => {
    await expect(
      renderDiffBlocks("~~~~diff\ndiff --git a/a b/a\n", async (patch) => patch),
    ).rejects.toThrow("unclosed diff fence");
  });
});

describe("renderIndex", () => {
  test("documents the stable conversational controls", () => {
    const output = renderIndex(
      "owner/repo",
      "2026-01-01T00:00:00Z",
      [{
        pr: pr(1, "stack/one", "main"),
        filename: "01-pr-1.md",
        patch: "01-pr-1.patch",
      }],
    );

    expect(output).toContain("`a <text>` add a note");
    expect(output).toContain("`e [target]` explain");
    expect(output).toContain("`n` next PR");
    expect(output).toContain("`r` render the current PR again");
  });
});

describe("renderReviewDocument", () => {
  test("renders one notes area, all comment streams, and the exact diff", () => {
    const patch = [
      "diff --git a/src/a.ts b/src/a.ts\n",
      "--- a/src/a.ts\n",
      "+++ b/src/a.ts\n",
      "@@ -1 +1 @@\n",
      "-old\n",
      "+new\n",
    ].join("");
    const output = renderReviewDocument(
      {
        repository: "owner/repo",
        generatedAt: "2026-01-01T00:00:00Z",
        position: 1,
        total: 2,
        patchFilename: "01.patch",
        pr: {
          ...pr(10, "stack/one", "main"),
          body: "PR body",
          author: { login: "author" },
          headRefOid: "abc123",
          baseRefOid: "def456",
          updatedAt: "2026-01-01T00:00:00Z",
          reviews: [
            {
              author: { login: "reviewer" },
              state: "CHANGES_REQUESTED",
              body: "Please fix this.",
            },
          ],
          comments: [
            {
              id: "IC_1",
              author: { login: "commenter" },
              body: "Conversation note",
            },
          ],
        },
        inlineComments: [
          {
            id: 42,
            path: "src/a.ts",
            line: 1,
            body: "Inline note",
            user: { login: "inline-reviewer" },
          },
        ],
      },
      patch,
    );

    expect(output).toContain("## PR notes");
    expect(output).toContain("> PR body");
    expect(output).toContain("@reviewer — CHANGES_REQUESTED");
    expect(output).toContain("> Conversation note");
    expect(output).toContain("src/a.ts:1 — @inline-reviewer");
    expect(output).toContain("**Base at generation:** `def456`");
    expect(output).toContain(
      "**PR updated at generation:** 2026-01-01T00:00:00Z",
    );
    expect(output).not.toContain("### Your annotations");
    expect(output.match(/^## Notes$/gm)).toHaveLength(1);
    expect(output.indexOf("## Notes")).toBeGreaterThan(output.indexOf("## File:"));
    expect(output).toContain(patch.trimEnd());
  });

  test("chooses a fence that cannot collide with fence-like patch lines", () => {
    const patch = [
      "diff --git a/README.md b/README.md\n",
      "--- a/README.md\n",
      "+++ b/README.md\n",
      "@@ -0,0 +1 @@\n",
      "~~~~\n",
    ].join("");
    const output = renderReviewDocument(
      {
        repository: "owner/repo",
        generatedAt: "2026-01-01T00:00:00Z",
        position: 1,
        total: 1,
        patchFilename: "01.patch",
        pr: pr(1, "stack/one", "main"),
        inlineComments: [],
      },
      patch,
    );
    expect(output).toContain("~~~~~diff");
    expect(output).toContain("\n~~~~\n");
  });
});
