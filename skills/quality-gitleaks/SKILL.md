---
name: quality-gitleaks
description: Set up gitleaks secret-scanning on a repo. Scans history for existing leaks first — stops if dirty, because installing CI on top of a polluted history makes CI permanently red. If history is clean, scaffolds .gitleaks.toml, a local pre-commit hook, and a pinned CI workflow that scans both git history and working tree. Use when the user says "add gitleaks", "set up secret scanning", "gitleaks boilerplate", or "/quality-gitleaks".
---

# quality-gitleaks

You are adding [gitleaks](https://github.com/gitleaks/gitleaks) secret-scanning to the current repo. The order matters:

1. **Baseline scan first.** If `gitleaks` already finds things in `HEAD` or in history, **stop**. Adding a pre-commit hook locks the user out of committing legit work until those findings are resolved; adding CI turns the default branch permanently red. The user has to triage (rotate? scrub history? allowlist a false positive?) before any of this is installed.
2. **Config, hook, workflow** — in that order, once the baseline is clean (or the user has explicitly allowlisted what's there).

Do not commit on the user's behalf. Write the files, show diffs, let them stage and commit.

## When to use

- "add gitleaks [to this repo]"
- "set up secret scanning"
- "gitleaks boilerplate" / "/quality-gitleaks"
- User mentions a leaked credential and wants to prevent the next one

## Hard prerequisites — check before doing anything

```bash
# 1. We're in a git repo
git rev-parse --show-toplevel >/dev/null 2>&1 \
  || { echo "Not a git repo. Abort."; exit 1; }

# 2. gitleaks is installed locally (needed for the baseline scan and hook)
command -v gitleaks >/dev/null 2>&1 \
  || { echo "gitleaks not installed. Run: brew install gitleaks"; exit 1; }

# 3. Capture default branch — needed for the CI workflow
gh repo view --json defaultBranchRef --jq '.defaultBranchRef.name' 2>/dev/null \
  || git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||' \
  || echo "main"
```

If gitleaks isn't installed, instruct the user to run `brew install gitleaks` (or the platform equivalent — see https://github.com/gitleaks/gitleaks#installing) and re-invoke. Don't try to install it yourself; this is a tool the user runs daily, they should know what's on their machine.

## Phase 1 — Baseline scan

Run **two** scans. Both, every time — they cover different surfaces:

```bash
# History: every commit reachable from HEAD
gitleaks git --redact --verbose .

# Working tree: files on disk (catches stuff that arrived via merge, submodule,
# generated files, etc. that history scan can miss)
gitleaks dir --redact --verbose .
```

`--redact` matters: without it, a matched secret is echoed to your terminal and shell history. Always pass it.

### If the baseline is clean

Proceed to Phase 2. Tell the user briefly: "Baseline scan found 0 leaks across history and working tree. Installing config + hook + CI."

### If the baseline finds something — STOP

Do **not** write the hook or CI. Do not silently add findings to an allowlist. Surface what was found (the redacted output is safe to show), and walk the user through the choice:

| What it is | What to do |
|------------|------------|
| **A real, current secret** | Rotate it *first* (revoke at the provider). Then decide whether to scrub history (`git filter-repo`, BFG) or accept that the value is in history and rely on rotation. Re-run the baseline once decided. |
| **A real, already-rotated secret** | Scrubbing history is optional. Most teams leave it — git history of a rotated credential is a hygiene problem, not an active risk. Add a path-specific allowlist entry once confirmed dead. |
| **A false positive** (test fixture, public sample, demo key) | Add to `.gitleaks.toml`'s `[allowlist].paths` (path-scoped) or `[allowlist].regexes` (value-scoped). Path-scoped is safer — value-scoped allowlists can mask real future leaks that happen to match. |
| **Unsure** | Stop. Get the user's eyes on the actual file/line. Never auto-classify a finding as a false positive. |

End the session here when blocked. Tell the user explicitly:

> Found N pre-existing finding(s). I haven't written the hook or CI — installing them now would block your next commit / break CI on first push. Resolve the findings (rotate, scrub, or allowlist), then re-invoke /quality-gitleaks.

History rewrites (`git filter-repo`, BFG) are destructive on shared history — every collaborator has to re-fetch and discard their local branches. Do not run them on the user's behalf. Explain the cost; let them decide.

## Phase 2 — Write `.gitleaks.toml`

Use the template at `assets/gitleaks.toml` (copied to the repo as `.gitleaks.toml`). Substitute `__REPO_NAME__` with the repo name (just for the `title =` field — cosmetic).

The template:
- Extends gitleaks' default ruleset (`useDefault = true`). Do not replace it — the default catches AWS keys, Stripe, Slack tokens, JWTs, etc.
- Has a small, explicit allowlist (LICENSE, the config file itself).
- Includes **commented-out** custom rule scaffolds. Ask the user which ones apply, then uncomment + adapt:
  - **Anthropic API key** — only useful if they use Claude. Cheap to add either way.
  - **Google OAuth client secret** (`GOCSPX-…`) — useful if they touch Google APIs.
  - **Personal home path** (`/Users/<name>/…`) — useful for open-source repos to keep maintainer paths out of docs/scripts. Skip on internal-only repos. If enabled, substitute `__USERNAME__` (`whoami` is the value) in **both** the `regex` and `keywords` fields — without this the rule matches only the literal string `/Users/__USERNAME__/…` and is silently inert.

Add new rules only when the user asks. The default ruleset is broad — extending it ad-hoc invites false positives.

Show the user the file before writing. Then write it to the repo root as `.gitleaks.toml`.

### Re-baseline with the new config

Phase 1's baseline ran with no `--config`, so it only checked against gitleaks' default ruleset. Any custom rule you just added (Anthropic key, Google OAuth secret, personal home path) could have pre-existing matches in history that Phase 1 missed — installing the hook/CI on top of that would block the next commit and turn CI red on first push. Re-run the dual scan, this time with the new config:

```bash
gitleaks git --config .gitleaks.toml --redact --verbose .
gitleaks dir --config .gitleaks.toml --redact --verbose .
```

If clean, proceed to Phase 3. If anything is found, **stop** and route through the same triage table as Phase 1 (rotate / scrub / allowlist), then re-run this scan. Do not install the hook or CI on a dirty re-baseline.

## Phase 3 — Add the pre-commit hook

The hook lives at `.githooks/pre-commit` (not `.git/hooks/` — that's not checked in and won't sync to collaborators).

```bash
mkdir -p .githooks
```

Copy `assets/pre-commit` to `.githooks/pre-commit`. Make it executable:

```bash
chmod +x .githooks/pre-commit
```

The hook is **inert** until each clone opts in:

```bash
git config core.hooksPath .githooks
```

This is per-clone, not committed (it's in `.git/config`). Tell the user explicitly:

> Each collaborator (including you, in this clone) needs to run `git config core.hooksPath .githooks` once. Without it, the hook won't fire. We deliberately don't auto-enable it — git refuses to run hooks the user hasn't opted into, and that's the right default.

Run it for the current clone if the user asks; otherwise just print the command.

## Phase 4 — Add the CI workflow

CI is the backstop. The local hook protects committers who opted in; CI catches everyone else (force-pushers, web-UI edits, collaborators who skipped `core.hooksPath`).

Use the template at `assets/gitleaks.yml`. Substitute:

- `__DEFAULT_BRANCH__` → captured default branch (e.g. `main`)
- `__GITLEAKS_VERSION__` → the gitleaks version to pin

To pin to current latest:

```bash
gh release view --repo gitleaks/gitleaks --json tagName --jq '.tagName' | sed 's/^v//'
# Example output: 8.30.1
```

Show the user the resolved version. Write the file to `.github/workflows/gitleaks.yml`:

```bash
mkdir -p .github/workflows
```

### Why curl-install vs. the gitleaks-action

The template installs gitleaks via a curl-pinned tarball rather than `gitleaks/gitleaks-action`. Two reasons:

- The version pin lives in the workflow file itself — visible in diffs, easy to bump.
- One fewer third-party action in the supply chain. Composability over convenience here.

If the user objects (some teams standardize on marketplace actions for CODEOWNERS / Dependabot reasons), respect that. Swap to `gitleaks/gitleaks-action@<SHA>` and note the trade-off.

## End-of-session summary

```
Baseline scan: clean across history + working tree.

Wrote:
  .gitleaks.toml                        — extends default ruleset
  .githooks/pre-commit                  — staged-changes scan, --redact
  .github/workflows/gitleaks.yml        — CI scan on push/PR, gitleaks <version>

What to do next:
  1. Activate the local hook (per clone):
       git config core.hooksPath .githooks
  2. Stage and commit the three new files.
  3. Push. The CI workflow will run on the PR / next push to <default-branch>.
  4. Share the core.hooksPath command with collaborators (README is a fine place).
```

## Triage assistance (interstitial, optional)

If the user comes back later — CI failed, or the hook is blocking a commit — help them per-finding. The decision tree is the same as the baseline-scan table above. The high-leverage moves:

| Situation | First move |
|-----------|------------|
| Hook blocks a commit that the user knows is fine | Look at the matched value redacted in the hook output. If it's genuinely a fixture / sample / docs, add a path-scoped allowlist entry in `.gitleaks.toml`. Re-stage, re-commit. |
| CI fails on a PR that didn't trigger the hook | Either the contributor didn't opt into the hook, or the finding is in history they pulled in. Treat as a fresh baseline-scan finding: rotate-or-allowlist. |
| Tons of fixture-file false positives | Path-scope them: `[[rules]].allowlist.paths = ['''test/fixtures/''']` — or, simpler, a top-level `paths = [...]` in the `[allowlist]` table. |
| A whole rule is noisy and not useful for this repo | Disable it: `[[rules]] id = "<id>" allowlist.regexes = ['''.*''']` is heavy-handed; better is `extend.disabledRules = ["<id>"]` at the top. |
| User wants a `.gitleaksignore` file instead | Supported — one path per line, gitleaks reads it automatically. Simpler for path-only exclusions; `.gitleaks.toml` is needed for everything else. |

When advising on allowlists, repeat the rule: **path-scope before value-scope.** A regex allowlist can silently swallow a real future leak that happens to match. A path allowlist is bounded to one file.

## Edge cases

- **Repo has existing `.gitleaks.toml`.** Read it, diff against the template, ask before overwriting. The user may have rules you'd be deleting.
- **Repo has existing `.githooks/pre-commit`.** Same — read it, see if it already calls gitleaks, ask before changing.
- **Repo has existing `.github/workflows/gitleaks.yml` (or any workflow named `gitleaks`).** Read it; if it's roughly equivalent (scans history + working tree, version-pinned), say so and skip rewriting. The skill's job is to get the boilerplate in place, not to enforce a specific style.
- **Repo is empty / no commits yet.** `gitleaks git` has nothing to scan but won't error. Run `gitleaks dir` only. Proceed normally; baseline is trivially clean.
- **Repo uses husky or another git-hooks manager.** `.githooks/pre-commit` won't fire under husky. Detect (`ls .husky/` or `cat package.json | grep husky`) and write the scan command into the existing husky `pre-commit` script instead: `gitleaks git --staged --redact --verbose --config .gitleaks.toml .`. Don't create a parallel `.githooks/` directory the user will forget exists.
- **User wants gitleaks on a monorepo with multiple roots.** The CI workflow scans the repo root by default. If different packages want different rules, point them at gitleaks' `[[rules]].path` matching — out of scope for this skill to scaffold, but worth a sentence.
- **User asks to `gitleaks protect`.** That subcommand is deprecated as of gitleaks v8.18. Use `gitleaks git --staged` instead — it's the supported replacement and the hook template already uses it.

## Guidelines

- Do not commit on the user's behalf. Write the files, show the diff, let them commit.
- Never silently allowlist a baseline finding. Every entry in `[allowlist]` needs a comment explaining why that path / regex can never contain a real secret.
- Always pass `--redact` to gitleaks invocations. Without it, matched secret values land in shell history and CI logs.
- Path-scope allowlists before value-scope. Value-scope is a footgun.
- Pin the CI gitleaks version in the workflow file. Floating versions turn "added a scan" into "scan broke and nobody noticed."
- If the local hook won't run (no `core.hooksPath` opt-in), don't fight it — explain why opting in is a per-clone choice and let the user decide.
