# @zcaceres/skill-review-code

## 0.2.0

### Minor Changes

- cd689bf: Add a `comments` subcommand to `review-code` — the inbound counterpart to
  `review`. It fetches the review feedback a reviewer left on your PR (review
  summaries, conversation comments, and line-anchored inline comments via `gh`),
  sorts them into a stable-numbered task list, and works each item: implement the
  change, push back with evidence, or decline with a reason — then replies on the
  thread and pushes. It reuses the pipeline's existing discipline (`repro` to
  validate a doubtful reviewer claim, `fix`'s plan-then-approve gate for
  non-trivial edits) and treats every comment as a claim to verify rather than a
  command to obey blindly.

## 0.1.0

### Minor Changes

- 5c0b177: Consolidate the code-review trio into one `/review-code` skill with
  subcommands, mirroring the `pr` and `gh-project` bundling. Bare
  `/review-code` still runs the review (default subcommand); `repro` and
  `fix` replace the standalone `review-code-repro` and `review-code-fix`
  skills, whose packages are removed. The per-step workflows are ported
  verbatim into `references/`. The pending changeset for the removed
  packages is dropped with them.
