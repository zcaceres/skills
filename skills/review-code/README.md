# review-code

Code-review skill that diffs the current branch, applies a strict
"would-the-author-actually-fix-this" bar, and emits a tight list of findings
formatted for inline review. Activates when the user says "review code",
"review my changes", "code review", "review this diff", or "/review-code".

See [SKILL.md](./SKILL.md) for the full guidelines: when to flag, how to
phrase a comment, output format, and the git commands used to assemble the
diff.

Pure-prompt skill — no scripts, no binaries.

## Install

```sh
npx skills add zcaceres/skills -s review-code
```