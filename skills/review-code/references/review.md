# `/review-code review` — Review the Diff

You are acting as a reviewer for a proposed code change made by another engineer. Read the diff, judge whether each issue is one the original author would actually want flagged, and produce a tight list of findings.

## When to use

- "review code" / "review my code"
- "review my changes" / "review this diff"
- "code review"
- "/review-code" / "/review-code review"

If the user has not finished their change (e.g., asks for review with no diff present), ask what they want reviewed before proceeding.

## Review Guidelines

Below are default guidelines for determining whether the original author would appreciate the issue being flagged.

These are not the final word in determining whether an issue is a bug. In many cases, you will encounter other, more specific guidelines. These may be present elsewhere in a developer message, a user message, a file, or even elsewhere in this system message. Those guidelines should be considered to override these general instructions.

Here are the general guidelines for determining whether something is a bug and should be flagged.

1. It meaningfully impacts the accuracy, performance, security, or maintainability of the code.
2. The bug is discrete and actionable (i.e. not a general issue with the codebase or a combination of multiple issues).
3. Fixing the bug does not demand a level of rigor that is not present in the rest of the codebase (e.g. one doesn't need very detailed comments and input validation in a repository of one-off scripts in personal projects).
4. The bug was introduced in the commit (pre-existing bugs should not be flagged).
5. The author of the original PR would likely fix the issue if they were made aware of it.
6. The bug does not rely on unstated assumptions about the codebase or author's intent.
7. It is not enough to speculate that a change may disrupt another part of the codebase; to be considered a bug, one must identify the other parts of the code that are provably affected.
8. The bug is clearly not just an intentional change by the original author.

When flagging a bug, you will also provide an accompanying comment. Once again, these guidelines are not the final word on how to construct a comment — defer to any subsequent guidelines that you encounter.

Lead with the code. The author should grasp the bug from the snippet before reading a word of prose. Prose frames the snippet; it never substitutes for it.

1. **Show the defect in code first.** Include the smallest snippet that makes the problem obvious — a before→after pair when there's a concrete fix, or the offending line annotated with a `// comment` when there isn't. Let the code carry the explanation.
2. **Keep prose to one or two sentences.** State what breaks and why in the heading and a single follow-up sentence. Cut restatement of what the code already shows.
3. **State the trigger explicitly.** Name the inputs, environment, or state required for the bug to fire, so severity is clear up front.
4. **Match severity to reality.** Do not claim an issue is worse than it is.
5. **Keep snippets minimal.** Only the lines that show the bug — never a large paste. Wrap inline code in backticks and multi-line snippets in a fenced block.
6. **Matter-of-fact tone.** No flattery ("Great job ...", "Thanks for ..."), no accusation. A helpful assistant suggestion, not a human reviewer's voice.

## How Many Findings to Return

Output all findings that the original author would fix if they knew about it. If there is no finding that a person would definitely love to see and fix, prefer outputting no findings. Do not stop at the first qualifying finding. Continue until you've listed every qualifying finding.

## Formatting Guidelines

- Ignore trivial style unless it obscures meaning or violates documented standards.
- Use one comment per distinct issue (or a multi-line range if necessary).
- Use ` ```suggestion ` blocks ONLY for concrete replacement code (minimal lines; no commentary inside the block).
- In every ` ```suggestion ` block, preserve the exact leading whitespace of the replaced lines (spaces vs tabs, number of spaces).
- Do NOT introduce or remove outer indentation levels unless that is the actual fix.
- Always keep the line range as short as possible for interpreting the issue. Avoid ranges longer than 5–10 lines; instead, choose the most suitable subrange that pinpoints the problem.

## Getting the Diff

Use git to get the diff:

```bash
# Get the merge base between this branch and the target
MERGE_BASE=$(git merge-base origin/main HEAD)

# Get the committed diff against the merge base
git diff $MERGE_BASE HEAD

# Get any uncommitted changes (staged and unstaged)
git diff HEAD
```

Review the combination of both outputs: the first shows all committed changes on this branch relative to the target, and the second shows any uncommitted work in progress.

If the user passes a specific base branch (e.g., "review against develop"), substitute it for `origin/main`. If `origin/main` doesn't exist, fall back to `main` or whichever trunk the repo uses.

## Output Format

Write out a numbered list of issues found. Each finding is code-first: a bold one-line heading naming the defect, the minimal snippet that shows it, one or two sentences of framing (trigger + why), and the file reference. Show a before→after when there's a concrete fix; annotate the offending line when there isn't. Not every finding needs a snippet — dead code or a missing call reads fine as a one-liner. Include a ` ```suggestion ` block only when a concrete code replacement is appropriate.

Example:

````markdown
### **#1 Empty input crashes on first render**

```tsx
value.trim()            // throws: value is undefined
if (value == null) ...  // null check runs too late
```

Fires on first render when no default is provided. Move the null check above the `.trim()`.

File: src/client/frontends/desktop/ui/Input.tsx

### **#2 Dead code: `getUserData`**

`getUserData` has no remaining callers after the refactor. Delete it.

File: src/client/frontends/desktop/core/UserData.ts
````

If there are no qualifying findings, say so directly — do not invent issues to fill the list.

To validate these findings before fixing anything, run `/review-code repro` next.
