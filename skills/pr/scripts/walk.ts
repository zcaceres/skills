import { mkdir, readFile, rename, rm, writeFile } from "fs/promises";
import { delimiter, join, relative, resolve } from "path";

interface Author {
  login?: string;
  name?: string;
}

export interface PullRequestSummary {
  number: number;
  title: string;
  url: string;
  body?: string;
  author?: Author;
  headRefName: string;
  headRefOid?: string;
  headRepositoryOwner?: Author;
  isCrossRepository?: boolean;
  baseRefName: string;
  baseRefOid?: string;
  isDraft?: boolean;
  state?: string;
  reviewDecision?: string;
  updatedAt?: string;
  reviews?: Review[];
  comments?: ConversationComment[];
}

interface Review {
  author?: Author;
  state?: string;
  body?: string;
  submittedAt?: string;
}

interface ConversationComment {
  id?: string;
  author?: Author;
  body?: string;
  createdAt?: string;
  url?: string;
}

export interface InlineComment {
  id?: number;
  in_reply_to_id?: number;
  path?: string;
  line?: number | null;
  original_line?: number | null;
  body?: string;
  created_at?: string;
  html_url?: string;
  user?: {
    login?: string;
  };
}

export interface ReviewDocumentInput {
  repository: string;
  generatedAt: string;
  position: number;
  total: number;
  pr: PullRequestSummary;
  inlineComments: InlineComment[];
  patchFilename: string;
}

interface PatchSection {
  path: string;
  content: string;
}

type DiffRenderer = (patch: string) => Promise<string>;

const PR_FIELDS = [
  "number",
  "title",
  "url",
  "body",
  "author",
  "headRefName",
  "headRefOid",
  "headRepositoryOwner",
  "isCrossRepository",
  "baseRefName",
  "baseRefOid",
  "isDraft",
  "state",
  "reviewDecision",
  "updatedAt",
  "reviews",
  "comments",
].join(",");

const PR_LIST_FIELDS = [
  "number",
  "title",
  "url",
  "headRefName",
  "headRefOid",
  "headRepositoryOwner",
  "isCrossRepository",
  "baseRefName",
  "baseRefOid",
  "isDraft",
  "state",
  "updatedAt",
].join(",");

function authorName(author: Author | undefined): string {
  const name = author?.login ?? author?.name;
  return name ? `@${name}` : "unknown";
}

function quoteMarkdown(value: string | undefined, empty = "_None._"): string {
  if (!value?.trim()) return empty;
  return value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}

function escapeHeading(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/`/g, "\\`");
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/^\[[^\]]+\]\s*/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "pr";
}

function fenceFor(content: string): string {
  let longest = 3;
  for (const line of content.replace(/\r\n/g, "\n").split("\n")) {
    const match = line.match(/^ {0,3}(~{3,})[ \t]*$/);
    if (match?.[1]) longest = Math.max(longest, match[1].length);
  }
  return "~".repeat(longest + 1);
}

function pathFromSection(content: string, index: number): string {
  const plusLine = content.match(/^\+\+\+ b\/(.+)$/m)?.[1];
  if (plusLine && plusLine !== "/dev/null") return plusLine;

  const header = content.match(/^diff --git a\/(.+) b\/(.+)$/m);
  if (header?.[2]) return header[2];

  const minusLine = content.match(/^--- a\/(.+)$/m)?.[1];
  if (minusLine && minusLine !== "/dev/null") return minusLine;
  return `patch-section-${index + 1}`;
}

export function splitPatch(patch: string): PatchSection[] {
  const starts: number[] = [];
  const matcher = /^diff --git /gm;
  for (let match = matcher.exec(patch); match; match = matcher.exec(patch)) {
    starts.push(match.index);
  }

  if (starts.length === 0) {
    return [{ path: "Complete patch", content: patch }];
  }

  const sections: PatchSection[] = [];
  if (starts[0]! > 0) {
    sections.push({ path: "Patch preamble", content: patch.slice(0, starts[0]) });
  }
  for (let i = 0; i < starts.length; i += 1) {
    const start = starts[i]!;
    const end = starts[i + 1] ?? patch.length;
    const content = patch.slice(start, end);
    sections.push({ path: pathFromSection(content, sections.length), content });
  }
  return sections;
}

export async function renderDiffBlocks(
  markdown: string,
  renderDiff: DiffRenderer,
): Promise<string> {
  const openingFence = /^(~{3,})diff[ \t]*\r?\n/gm;
  const output: string[] = [];
  let cursor = 0;

  for (
    let opening = openingFence.exec(markdown);
    opening;
    opening = openingFence.exec(markdown)
  ) {
    const fence = opening[1]!;
    const closingFence = new RegExp(`^${fence}[ \\t]*(?:\\r?\\n|$)`, "gm");
    closingFence.lastIndex = openingFence.lastIndex;
    const closing = closingFence.exec(markdown);
    if (!closing) {
      throw new Error("Review document contains an unclosed diff fence.");
    }

    output.push(markdown.slice(cursor, opening.index));
    const rendered = await renderDiff(
      markdown.slice(openingFence.lastIndex, closing.index),
    );
    output.push(rendered);
    if (
      rendered.length > 0 &&
      !rendered.endsWith("\n") &&
      closing[0].endsWith("\n")
    ) {
      output.push("\n");
    }
    cursor = closingFence.lastIndex;
    openingFence.lastIndex = cursor;
  }

  output.push(markdown.slice(cursor));
  return output.join("");
}

function renderInlineComment(comment: InlineComment): string {
  const line = comment.line ?? comment.original_line;
  const location = comment.path
    ? `${comment.path}${line ? `:${line}` : ""}`
    : "Unknown location";
  const reply = comment.in_reply_to_id
    ? ` · reply to ${comment.in_reply_to_id}`
    : "";
  const link = comment.html_url ? ` · [GitHub](${comment.html_url})` : "";
  return [
    `#### ${escapeHeading(location)} — ${authorName(comment.user)}`,
    "",
    `Comment ID: \`${comment.id ?? "unknown"}\`${reply}${link}`,
    "",
    quoteMarkdown(comment.body),
  ].join("\n");
}

function renderPatchSection(
  section: PatchSection,
  comments: InlineComment[],
): string {
  const fence = fenceFor(section.content);
  const renderedPatch =
    section.content + (section.content.endsWith("\n") ? "" : "\n");
  const sectionComments = comments.filter(
    (comment) => comment.path === section.path,
  );
  const lines = [`## File: \`${escapeHeading(section.path)}\``, ""];

  if (sectionComments.length > 0) {
    lines.push(
      "### Existing inline review comments",
      "",
      sectionComments.map(renderInlineComment).join("\n\n"),
      "",
    );
  }

  lines.push(
    "### Diff",
    "",
    `${fence}diff`,
    renderedPatch.replace(/\n$/, ""),
    fence,
  );
  return lines.join("\n");
}

export function renderReviewDocument(
  input: ReviewDocumentInput,
  patch: string,
): string {
  const { pr } = input;
  const reviews = pr.reviews ?? [];
  const comments = pr.comments ?? [];
  const sections = splitPatch(patch);
  const sectionPaths = new Set(sections.map((section) => section.path));
  const unplacedInlineComments = input.inlineComments.filter(
    (comment) => !comment.path || !sectionPaths.has(comment.path),
  );

  const lines = [
    `<!-- pr-walk: pr=${pr.number} position=${input.position}/${input.total} head=${pr.headRefName} head-oid=${pr.headRefOid ?? "unknown"} base-oid=${pr.baseRefOid ?? "unknown"} updated-at=${pr.updatedAt ?? "unknown"} -->`,
    `# ${String(input.position).padStart(2, "0")}/${String(input.total).padStart(2, "0")} — PR #${pr.number}: ${pr.title}`,
    "",
    `- **Repository:** \`${input.repository}\``,
    `- **PR:** [#${pr.number}](${pr.url})`,
    `- **Author:** ${authorName(pr.author)}`,
    `- **Stack edge:** \`${pr.baseRefName}\` ← \`${pr.headRefName}\``,
    `- **State:** ${pr.state ?? "unknown"}${pr.isDraft ? " · draft" : ""}`,
    `- **Review decision:** ${pr.reviewDecision || "none"}`,
    `- **Head at generation:** \`${pr.headRefOid ?? "unknown"}\``,
    `- **Base at generation:** \`${pr.baseRefOid ?? "unknown"}\``,
    `- **PR updated at generation:** ${pr.updatedAt ?? "unknown"}`,
    `- **Generated:** ${input.generatedAt}`,
    `- **Canonical patch:** [\`${input.patchFilename}\`](./${input.patchFilename})`,
    "",
    "## PR notes",
    "",
    quoteMarkdown(pr.body),
    "",
    "## Submitted reviews",
    "",
  ];

  if (reviews.length === 0) {
    lines.push("_None._");
  } else {
    for (const review of reviews) {
      lines.push(
        `### ${authorName(review.author)} — ${review.state ?? "COMMENTED"}`,
        "",
        review.submittedAt ? `Submitted: ${review.submittedAt}` : "",
        review.submittedAt ? "" : "",
        quoteMarkdown(review.body),
        "",
      );
    }
  }

  lines.push("## Conversation comments", "");
  if (comments.length === 0) {
    lines.push("_None._", "");
  } else {
    for (const comment of comments) {
      lines.push(
        `### ${authorName(comment.author)}`,
        "",
        [
          comment.id ? `Comment ID: \`${comment.id}\`` : "",
          comment.url ? `[GitHub](${comment.url})` : "",
          comment.createdAt ?? "",
        ]
          .filter(Boolean)
          .join(" · "),
        "",
        quoteMarkdown(comment.body),
        "",
      );
    }
  }

  lines.push(
    ...sections.map((section) =>
      renderPatchSection(section, input.inlineComments)
    ).flatMap((section) => [section, ""]),
  );

  if (unplacedInlineComments.length > 0) {
    lines.push(
      "## Other inline review comments",
      "",
      "These comments could not be matched to a file in the current diff, usually because the referenced code is outdated.",
      "",
      unplacedInlineComments.map(renderInlineComment).join("\n\n"),
      "",
    );
  }

  lines.push(
    "## Notes",
    "",
    "Describe everything you want to discuss or change in this PR here: code changes, questions, decisions, tests, GitHub replies, or stack operations. Mention a file or line when location matters. Use explicit action verbs when you want the agent to act; questions and observations are not treated as approval.",
    "",
    "- [ ] ",
    "",
  );
  return lines.filter((line, index, all) =>
    line !== "" || index === 0 || all[index - 1] !== ""
  ).join("\n");
}

export function orderLinearStack(
  start: PullRequestSummary,
  parentByNumber: Map<number, PullRequestSummary | undefined>,
  childByNumber: Map<number, PullRequestSummary | undefined>,
): PullRequestSummary[] {
  const ancestors: PullRequestSummary[] = [];
  const seen = new Set<number>([start.number]);
  let cursor: PullRequestSummary | undefined = start;
  while ((cursor = parentByNumber.get(cursor.number))) {
    if (seen.has(cursor.number)) throw new Error("PR stack contains a cycle.");
    seen.add(cursor.number);
    ancestors.unshift(cursor);
  }

  const descendants: PullRequestSummary[] = [];
  cursor = start;
  while ((cursor = childByNumber.get(cursor.number))) {
    if (seen.has(cursor.number)) throw new Error("PR stack contains a cycle.");
    seen.add(cursor.number);
    descendants.push(cursor);
  }
  return [...ancestors, start, ...descendants];
}

export function assertStablePullRequest(
  expected: PullRequestSummary,
  current: PullRequestSummary,
): void {
  if ((current.state ?? "").toUpperCase() !== "OPEN") {
    throw new Error(
      `PR #${current.number} became ${(current.state ?? "unknown").toLowerCase()} while preparing the walk; no packet was published.`,
    );
  }
  if (
    current.headRefName !== expected.headRefName ||
    current.baseRefName !== expected.baseRefName
  ) {
    throw new Error(
      `PR #${current.number} changed stack position while preparing the walk (${expected.baseRefName} ← ${expected.headRefName} became ${current.baseRefName} ← ${current.headRefName}); no packet was published.`,
    );
  }
  if (
    expected.headRefOid &&
    current.headRefOid !== expected.headRefOid
  ) {
    throw new Error(
      `PR #${current.number} head moved while preparing the walk (${expected.headRefOid} → ${current.headRefOid ?? "unknown"}); no packet was published.`,
    );
  }
  if (
    expected.baseRefOid &&
    current.baseRefOid !== expected.baseRefOid
  ) {
    throw new Error(
      `PR #${current.number} base moved while preparing the walk (${expected.baseRefOid} → ${current.baseRefOid ?? "unknown"}); no packet was published.`,
    );
  }
  if (
    expected.updatedAt &&
    current.updatedAt !== expected.updatedAt
  ) {
    throw new Error(
      `PR #${current.number} metadata or discussion changed while preparing the walk (${expected.updatedAt} → ${current.updatedAt ?? "unknown"}); no packet was published.`,
    );
  }
}

async function run(
  command: string,
  args: string[],
  cwd: string,
): Promise<string> {
  const process = Bun.spawn([command, ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  if (exitCode !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed:\n${stderr.trim() || stdout.trim()}`,
    );
  }
  return stdout;
}

async function isGitDelta(command: string, cwd: string): Promise<boolean> {
  try {
    const help = await run(command, ["--help"], cwd);
    return help.includes("A viewer for git and diff output") &&
      help.includes("--paging");
  } catch {
    return false;
  }
}

async function findGitDelta(cwd: string): Promise<string | undefined> {
  const override = process.env.PR_WALK_DELTA?.trim();
  const executableNames = process.platform === "win32"
    ? ["delta.exe", "delta"]
    : ["delta"];
  const candidates = override
    ? [override]
    : (process.env.PATH ?? "")
      .split(delimiter)
      .filter(Boolean)
      .flatMap((directory) =>
        executableNames.map((name) => join(directory, name))
      );

  for (const candidate of new Set(candidates)) {
    if (await isGitDelta(candidate, cwd)) return candidate;
  }
  return undefined;
}

async function renderWithGitDelta(
  executable: string,
  patch: string,
  cwd: string,
): Promise<string> {
  const process = Bun.spawn(
    [executable, "--paging=never", "--line-numbers"],
    {
      cwd,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  process.stdin.write(patch);
  process.stdin.end();
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  if (exitCode !== 0) {
    throw new Error(
      `git-delta failed:\n${stderr.trim() || stdout.trim()}`,
    );
  }
  return stdout;
}

export async function renderWalkDocument(
  args: string[],
  cwd = process.cwd(),
): Promise<string> {
  if (args.length !== 1 || args[0]!.startsWith("-")) {
    throw new Error("Usage: /pr walk renderer <review-document.md>");
  }

  const documentPath = resolve(cwd, args[0]!);
  const gitDelta = await findGitDelta(cwd);
  if (!gitDelta) {
    throw new Error(
      "Could not find the git-delta diff viewer. Install git-delta, or set PR_WALK_DELTA to its executable path if another `delta` command shadows it.",
    );
  }

  const markdown = await readFile(documentPath, "utf8");
  return renderDiffBlocks(
    markdown,
    (patch) => renderWithGitDelta(gitDelta, patch, cwd),
  );
}

async function runJson<T>(
  command: string,
  args: string[],
  cwd: string,
): Promise<T> {
  const output = await run(command, args, cwd);
  return JSON.parse(output) as T;
}

async function findCandidates(
  cwd: string,
  repositoryOwner: string,
  flag: "--head" | "--base",
  branch: string,
  exclude: number,
): Promise<PullRequestSummary[]> {
  const candidates = await runJson<PullRequestSummary[]>(
    "gh",
    [
      "pr",
      "list",
      flag,
      branch,
      "--state",
      "open",
      "--limit",
      "20",
      "--json",
      PR_LIST_FIELDS,
    ],
    cwd,
  );
  return candidates.filter((pr) =>
    pr.number !== exclude &&
    isStackCandidateFromRepository(pr, repositoryOwner)
  );
}

export function isStackCandidateFromRepository(
  candidate: PullRequestSummary,
  repositoryOwner: string,
): boolean {
  return candidate.isCrossRepository === false &&
    candidate.headRepositoryOwner?.login?.toLowerCase() ===
      repositoryOwner.toLowerCase();
}

export function assertPullRequestInRepository(
  pullRequestUrl: string,
  repository: string,
): void {
  let resolvedRepository: string | undefined;
  try {
    const parts = new URL(pullRequestUrl).pathname.split("/").filter(Boolean);
    if (parts[2] === "pull" && parts[0] && parts[1]) {
      resolvedRepository = `${parts[0]}/${parts[1]}`;
    }
  } catch {
    // Fall through to the explicit invalid-URL error below.
  }

  if (!resolvedRepository) {
    throw new Error(
      `Could not determine a repository from PR URL ${pullRequestUrl}.`,
    );
  }
  if (resolvedRepository.toLowerCase() !== repository.toLowerCase()) {
    throw new Error(
      `PR URL resolves to ${resolvedRepository}, but the current repository is ${repository}. Run /pr walk from the PR's repository.`,
    );
  }
}

async function discoverStack(
  cwd: string,
  repositoryOwner: string,
  start: PullRequestSummary,
): Promise<PullRequestSummary[]> {
  const parentByNumber = new Map<number, PullRequestSummary | undefined>();
  const childByNumber = new Map<number, PullRequestSummary | undefined>();

  let cursor = start;
  const ancestorSeen = new Set<number>([start.number]);
  while (true) {
    const candidates = (await findCandidates(
      cwd,
      repositoryOwner,
      "--head",
      cursor.baseRefName,
      cursor.number,
    )).filter((candidate) => candidate.headRefName === cursor.baseRefName);
    if (candidates.length > 1) {
      throw new Error(
        `Ambiguous parent for PR #${cursor.number}: ${candidates.map((pr) => `#${pr.number}`).join(", ")}.`,
      );
    }
    const parent = candidates[0];
    parentByNumber.set(cursor.number, parent);
    if (!parent) break;
    if (ancestorSeen.has(parent.number)) {
      throw new Error("PR stack contains a cycle.");
    }
    ancestorSeen.add(parent.number);
    cursor = parent;
  }

  cursor = start;
  const descendantSeen = new Set<number>([start.number]);
  while (true) {
    const candidates = (await findCandidates(
      cwd,
      repositoryOwner,
      "--base",
      cursor.headRefName,
      cursor.number,
    )).filter((candidate) => candidate.baseRefName === cursor.headRefName);
    if (candidates.length > 1) {
      throw new Error(
        `PR #${cursor.number} has multiple open children: ${candidates.map((pr) => `#${pr.number}`).join(", ")}. Review a child branch separately rather than guessing.`,
      );
    }
    const child = candidates[0];
    childByNumber.set(cursor.number, child);
    if (!child) break;
    if (descendantSeen.has(child.number)) {
      throw new Error("PR stack contains a cycle.");
    }
    descendantSeen.add(child.number);
    cursor = child;
  }

  return orderLinearStack(start, parentByNumber, childByNumber);
}

function flattenInlinePages(value: unknown): InlineComment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) =>
    Array.isArray(entry) ? entry : [entry]
  ) as InlineComment[];
}

function stackName(stack: PullRequestSummary[]): string {
  const marker = stack[0]?.title.match(/^\[([^\]]+?)\s+\d+\/\d+\]/)?.[1];
  return slugify(marker ?? stack[0]?.headRefName ?? "stack");
}

export function renderIndex(
  repository: string,
  generatedAt: string,
  documents: Array<{ pr: PullRequestSummary; filename: string; patch: string }>,
): string {
  return [
    "# PR walk",
    "",
    `- **Repository:** \`${repository}\``,
    `- **Generated:** ${generatedAt}`,
    "- **Direction:** bottom → top",
    "",
    "Review each document in order and put all feedback in its single `Notes` section. Mention a file or line when location matters. Keep the generated diff blocks unchanged; each `.patch` file is the canonical diff.",
    "",
    "**Chat controls:** `a <text>` add a note · `e [target]` explain the PR or a specific part · `n` next PR · `b` previous PR · `r` render the current PR again · `q` save and pause.",
    "",
    "## Stack",
    "",
    ...documents.map(({ pr, filename, patch }, index) =>
      `- [ ] ${String(index + 1).padStart(2, "0")}. [PR #${pr.number}: ${pr.title}](./${filename}) · [patch](./${patch}) · \`${pr.baseRefName}\` ← \`${pr.headRefName}\``
    ),
    "",
    "## Session notes",
    "",
    "- [ ] ",
    "",
  ].join("\n");
}

export async function prepareWalk(
  args: string[],
  cwd = process.cwd(),
): Promise<string> {
  const unknownFlag = args.find((arg) => arg.startsWith("-"));
  if (unknownFlag) {
    throw new Error(`Unknown /pr walk preparer flag: ${unknownFlag}`);
  }
  if (args.length > 1) {
    throw new Error("Usage: /pr walk [PR-number-or-URL]");
  }

  const repoRoot = (await run(
    "git",
    ["rev-parse", "--show-toplevel"],
    cwd,
  )).trim();
  try {
    await run(
      "git",
      ["check-ignore", "-q", "artifacts/pr-walk/.pr-walk-ignore-check"],
      repoRoot,
    );
  } catch {
    throw new Error(
      "`artifacts/pr-walk/` is not ignored. Add `artifacts/` to `.gitignore` or `/artifacts/pr-walk/` to `.git/info/exclude`, then rerun `/pr walk`.",
    );
  }

  const repository = (await run(
    "gh",
    ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"],
    repoRoot,
  )).trim();
  const repositoryOwner = repository.split("/", 1)[0];
  if (!repositoryOwner) {
    throw new Error(`Could not determine repository owner from ${repository}.`);
  }
  const selector = args[0];
  const startArgs = ["pr", "view"];
  if (selector) startArgs.push(selector);
  startArgs.push("--json", PR_FIELDS);
  const start = await runJson<PullRequestSummary>("gh", startArgs, repoRoot);
  assertPullRequestInRepository(start.url, repository);
  if ((start.state ?? "").toUpperCase() !== "OPEN") {
    throw new Error(
      `PR #${start.number} is ${(start.state ?? "unknown").toLowerCase()}; /pr walk includes open stacks only.`,
    );
  }

  const stack = await discoverStack(repoRoot, repositoryOwner, start);
  const generatedAt = new Date().toISOString();
  const timestamp = generatedAt.replace(/[-:.]/g, "");
  const walkRoot = join(
    repoRoot,
    "artifacts",
    "pr-walk",
  );
  const sessionDir = join(walkRoot, `${timestamp}-${stackName(stack)}`);
  const temporarySessionDir = `${sessionDir}.tmp-${process.pid}`;
  await mkdir(walkRoot, { recursive: true });
  await mkdir(temporarySessionDir, { recursive: false });

  const documents: Array<{
    pr: PullRequestSummary;
    filename: string;
    patch: string;
  }> = [];

  try {
    for (let index = 0; index < stack.length; index += 1) {
      const summary = stack[index]!;
      const pr = await runJson<PullRequestSummary>(
        "gh",
        ["pr", "view", String(summary.number), "--json", PR_FIELDS],
        repoRoot,
      );
      assertStablePullRequest(summary, pr);
      const inlinePages = await runJson<unknown>(
        "gh",
        [
          "api",
          `repos/${repository}/pulls/${pr.number}/comments`,
          "--paginate",
          "--slurp",
        ],
        repoRoot,
      );
      const patch = await run(
        "gh",
        ["pr", "diff", String(pr.number), "--color", "never"],
        repoRoot,
      );
      const prefix = String(index + 1).padStart(2, "0");
      const stem = `${prefix}-pr-${pr.number}-${slugify(pr.title)}`;
      const patchFilename = `${stem}.patch`;
      const markdownFilename = `${stem}.md`;
      await writeFile(join(temporarySessionDir, patchFilename), patch);
      await writeFile(
        join(temporarySessionDir, markdownFilename),
        renderReviewDocument(
          {
            repository,
            generatedAt,
            position: index + 1,
            total: stack.length,
            pr,
            inlineComments: flattenInlinePages(inlinePages),
            patchFilename,
          },
          patch,
        ),
      );
      documents.push({
        pr,
        filename: markdownFilename,
        patch: patchFilename,
      });
    }

    for (const document of documents) {
      const current = await runJson<PullRequestSummary>(
        "gh",
        ["pr", "view", String(document.pr.number), "--json", PR_FIELDS],
        repoRoot,
      );
      assertStablePullRequest(document.pr, current);
    }

    await writeFile(
      join(temporarySessionDir, "00-stack.md"),
      renderIndex(repository, generatedAt, documents),
    );
    await rename(temporarySessionDir, sessionDir);
  } catch (error) {
    await rm(temporarySessionDir, { recursive: true, force: true });
    throw error;
  }

  const relativeSession = relative(repoRoot, sessionDir);
  return [
    `Prepared ${documents.length} PR${documents.length === 1 ? "" : "s"} in ${relativeSession}:`,
    `- ${join(relativeSession, "00-stack.md")}`,
    ...documents.map(({ pr, filename }, index) =>
      `- ${String(index + 1).padStart(2, "0")}. PR #${pr.number}: ${join(relativeSession, filename)}`
    ),
    "",
    `Start with ${join(relativeSession, documents[0]!.filename)}.`,
  ].join("\n");
}
