---
"@zcaceres/skill-test": minor
---

Add the `test` skill — a test-suite completeness reviewer structured as a
dispatcher (like `review-code`) so more test-related subcommands can be added
later. The first and default subcommand, `gaps`, cross-references the tests
against the source they cover and reports missing edge cases — untested
branches, error paths, and boundary conditions — as a numbered list of
findings. It defaults to the current branch diff and accepts a file, directory,
module, or base branch as a scope override, and applies a strict
"would-the-author-actually-add-this-test" bar to keep the output to high-value
gaps.
