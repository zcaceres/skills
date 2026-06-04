---
name: clean-ai-slop
description: Find and remove AI-generated code slop introduced on the current branch — superfluous comments, defensive try/catch, casts to any, and other stylistic noise inconsistent with the rest of the file. Use when user says "clean ai slop", "remove ai slop", "strip ai code", or "/clean-ai-slop".
---

# Remove AI code slop

Check the diff against `main`, and remove all AI-generated slop introduced on
this branch.

This includes:

- Extra comments that a human wouldn't add or that are inconsistent with the
  rest of the file
- Extra defensive checks or `try/catch` blocks that are abnormal for that area
  of the codebase (especially when called by trusted / already-validated
  codepaths)
- Casts to `any` (or equivalent escape hatches) used to paper over type issues
  rather than fix them
- Any other style that is inconsistent with the surrounding file — naming,
  formatting, abstraction level, error-handling conventions

## Workflow

1. Run `git diff main...HEAD` (or the repo's actual trunk branch) to see what
   this branch changed.
2. For each changed file, read enough surrounding context to learn the local
   conventions — don't judge slop in a vacuum.
3. Remove the noise. Don't refactor beyond what the slop fix requires; this
   skill cleans, it doesn't redesign.
4. Leave behavior unchanged. If a defensive check was load-bearing (catches a
   real failure mode at a trust boundary), keep it.

## Report

End with a 1–3 sentence summary of what you changed. No bullet lists, no
file-by-file breakdown — the diff is the detailed view.
