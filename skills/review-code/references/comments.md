# `/review-code comments` — Process Inbound PR Review Comments

You are processing review feedback that **another person left on your pull
request**. Fetch the comments from GitHub, turn them into a task list, and work
each item — implement, discuss, or decline — then reply on the thread and push.

This is the mirror image of the other subcommands: `review` produces findings
on a diff; `comments` *consumes* findings someone else wrote on your PR. Treat a
reviewer's comment as a claim, not a command — it can be right, partially right,
or wrong, and you owe a real answer either way.

## When to use

- "process the PR comments" / "address the review comments"
- "handle the feedback on my PR" / "respond to the reviewer"
- "what did the reviewer ask for" / "resolve review comments"
- "/review-code comments" / "/review-code comments 123"

If there is no PR for the current branch and the user didn't pass a number, say
so and ask which PR before proceeding — don't guess.

## Prerequisites

- GitHub CLI (`gh`) authenticated, and the repo has a GitHub remote.
- Resolve the PR number first. With no argument, use the current branch's PR:
  `gh pr view --json number -q .number`. With an argument, use it verbatim.

## 1. Fetch the PR and its comments

A PR carries three distinct comment streams — fetch all three, they don't
overlap:

```bash
# PR metadata, the review summaries, and top-level issue comments
gh pr view <number> --json number,title,headRefName,reviews,comments

# Inline review comments (anchored to a file + line) — the main work item
gh api "repos/{owner}/{repo}/pulls/<number>/comments" --paginate
```

- `reviews[]` — each reviewer's overall verdict (APPROVED / CHANGES_REQUESTED /
  COMMENTED) plus their summary body.
- `comments[]` (from `pr view`) — conversation-tab comments not tied to a line.
- the `pulls/<n>/comments` array — line-anchored inline comments. Each has an
  `id` (needed to reply), `path`, `line`/`original_line`, `body`, `user.login`,
  and `in_reply_to_id` (set on replies — collapse a thread to its root).

## 2. Categorize

Sort every comment into one of:

- **Actionable** — a concrete change request ("rename this", "this leaks a file
  handle", "add a guard").
- **Question** — the reviewer wants to understand something; may or may not
  imply a change.
- **Informational** — FYI, praise, acknowledgment. No action.
- **Already resolved** — the thread is marked resolved, or a later commit
  already addressed it. Verify against the current code before trusting this.

Drop informational and already-resolved from the work list. Collapse reply
chains to the root comment so a single thread is one task, not N.

## 3. Build the task list

Present a numbered task list the user can steer, ordered by file then line (so
fixes to the same region batch together). For each actionable/question comment:

```markdown
### #N <one-line summary of the ask>

**Reviewer:** @login · **Type:** Actionable | Question
**Location:** path/to/file.ts:line   (or "PR-level" / "conversation")
**Thread:** <comment id, for replying>

> <the reviewer's comment, quoted>
```

Keep finding numbers stable — you'll reference them in replies and the summary.

## 4. Decide each item — don't auto-apply

Treat the reviewer's claim with the same skepticism `repro` applies to a
review finding. For each task, pick one:

1. **Implement** — the ask is correct and clear. Make the smallest change that
   satisfies it, matching surrounding style (the `fix` subcommand's plan-then-
   apply discipline applies — for a batch of non-trivial changes, lay out the
   plan and get approval before editing).
2. **Discuss** — the ask is unclear, or you think it's wrong. Draft a reply that
   asks the clarifying question or explains the disagreement with evidence
   (`file:line`, a failing/passing test). If a reviewer claims a bug you doubt,
   validate it first with `/review-code repro` rather than arguing from
   re-reading.
3. **Decline (with reason)** — the change is wrong, out of scope, or conflicts
   with a constraint. Draft a brief, matter-of-fact reason. Declining is a valid
   outcome; don't make a bad change to clear a thread.
4. **Defer** — legitimate but belongs in a follow-up. Note it and, if the user
   wants, open an issue.

Never silently skip a thread. Every actionable/question item ends with either a
change or a reply.

## 5. Reply on the threads

Reply on the **same thread** so the conversation stays anchored to the code.
For an inline review comment, reply to its thread:

```bash
gh api "repos/{owner}/{repo}/pulls/<number>/comments/<comment_id>/replies" \
  -f body="Fixed in <short-sha> — switched to a `defer`-closed handle."
```

For a PR-level / conversation comment, use the issue-comment endpoint:

```bash
gh pr comment <number> --body "..."
```

Reply guidance:
- Reference the commit that addressed it (`Fixed in <sha>`) so the reviewer can
  jump straight to the change.
- For declines, state the reason in one or two sentences — no defensiveness, no
  over-explaining.
- Don't post a reply per trivial nit if one summary comment reads better; use
  judgment.
- Resolving the thread itself (the "Resolve conversation" button) is a GraphQL
  `resolveReviewThread` mutation, not a REST call. Leave threads for the
  reviewer to resolve unless the user asks you to auto-resolve addressed ones.

## 6. Commit, push, summarize

- Group the changes into sensible commits with messages that reference the
  feedback (e.g. `fix: close file handle on early return (review feedback)`).
- Push to the PR's head branch (`headRefName` from step 1). Follow the repo's
  push norms — if this is a stacked PR, use the project's stacked-PR flow rather
  than a bare force-push.
- Post a closing summary mapping each task # to its outcome:

```markdown
**Addressed N of M review comments**

- #1 Implemented — <what changed> (<sha>)
- #2 Declined — <one-line reason>
- #3 Replied / awaiting reviewer — <the open question>
```

## Guidelines

- **A comment is a claim.** Verify before you change. The cost of blindly
  applying a wrong suggestion is a regression; the cost of pushing back with
  evidence is a sentence.
- **Don't widen scope.** Address what was asked. If you spot an adjacent issue
  while in the file, mention it in the summary; don't fix it under cover of
  "addressing feedback".
- **Stay matter-of-fact.** Replies should read as concise engineering, not
  appeasement — skip "Great catch!" and "Thanks so much".
- **Stop on a real decision.** If a comment implies a design choice you can't
  make alone, surface it to the user rather than guessing.
- **Keep numbering stable** from the task list through the replies and summary
  so the user (and reviewer) can follow 1:1.
