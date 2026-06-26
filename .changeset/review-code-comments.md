---
"@zcaceres/skill-review-code": minor
---

Add a `comments` subcommand to `review-code` — the inbound counterpart to
`review`. It fetches the review feedback a reviewer left on your PR (review
summaries, conversation comments, and line-anchored inline comments via `gh`),
sorts them into a stable-numbered task list, and works each item: implement the
change, push back with evidence, or decline with a reason — then replies on the
thread and pushes. It reuses the pipeline's existing discipline (`repro` to
validate a doubtful reviewer claim, `fix`'s plan-then-approve gate for
non-trivial edits) and treats every comment as a claim to verify rather than a
command to obey blindly.
