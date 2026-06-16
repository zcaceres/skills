# `/security-openssf fix` — Plan and apply Scorecard remediations

Take the findings from a Scorecard run, turn them into a concrete remediation
plan grouped by what kind of change each fix needs, stop at an approval gate,
then apply the file-based fixes and offer to run the settings-based ones.

This subcommand is the natural follow-up to a `scorecard-report.sh` run: the
report tells you *what's failing*; `fix` tells you *how to fix each one* and
does the safe, mechanical parts for you.

## When to use

- "fix the scorecard findings" / "remediate the openssf issues"
- "write a plan to fix these checks" / "/security-openssf fix"
- Right after showing the user a `scorecard-report.sh` report.

## Step 1 — Get the findings

Run the report so the plan is keyed to real, current data — never invent
findings:

```bash
skills/security-openssf/scripts/scorecard-report.sh --fetch <owner>/<repo>
# or, if the user already has a SARIF file:
skills/security-openssf/scripts/scorecard-report.sh path/to/results.sarif
```

Parse the "NEEDS ATTENTION" rows (check name, score, severity, reason). Passing
checks need no plan entry.

## Step 2 — Map each finding to a remediation recipe

For every failing check, classify it into one of three buckets. Bucket assignment
drives both the plan layout and what `fix` is allowed to do automatically.

**Bucket A — file changes (apply automatically once approved).** A fix that lives
in the repo as a file or workflow edit:

| Check | Fix |
|---|---|
| **Token-Permissions** | Add top-level `permissions: read-all` to every workflow that lacks it; keep any needed `write` scope at the job level only. |
| **Pinned-Dependencies** | Pin every `uses:` to a full commit SHA with a `# vX.Y.Z` trailing comment. Resolve each tag: `gh api repos/<owner>/<repo>/git/refs/tags/<tag> --jq '.object.sha'` (deref annotated tags via `.../git/tags/<sha>` if the first call returns a `tag` object). |
| **Dependency-Update-Tool** | Add `.github/dependabot.yml` with the `github-actions` ecosystem (and `npm`/others the repo uses). This also keeps the SHA pins fresh. |
| **License** | Add a `LICENSE` file at repo root. Match the license the project already declares (check `package.json` `license`, existing per-package `LICENSE` files, or ask). |
| **Security-Policy** | Add a `SECURITY.md` at repo root with a private reporting channel. |
| **SAST** | Add a CodeQL workflow (`github/codeql-action`) for the repo's compiled/scripting languages. Mark **optional** — skip if the repo is almost entirely docs/shell and CodeQL would add noise with little signal; say so in the plan. |

**Bucket B — repo settings (needs admin; offer the command, let the user run or
approve).** Not a file in the repo — a GitHub setting changed via API or UI:

| Check | Fix | Caveat |
|---|---|---|
| **Branch-Protection** | Enable protection on the default branch. Tier 1 (prevent force-push + deletion) is safe and non-disruptive. Higher tiers require reviews. | Use `gh api -X PUT repos/<owner>/<repo>/branches/<branch>/protection`. Show the exact body. |
| **Code-Review** | Require ≥1 approving review in branch protection. | **Disruptive for solo maintainers** — they can't merge their own PRs without a second reviewer. Flag this explicitly; default to NOT enabling it unless the user asks. |

**Bucket C — won't-fix / not-applicable (document the reason, take no action).**

| Check | Why it's usually C |
|---|---|
| **Maintained** | Time-based (e.g. "repo <90 days old"). Self-heals; nothing to fix. |
| **Fuzzing** | Genuinely N/A for most non-parser/non-library repos. Don't fake it. |
| **CII-Best-Practices** | Manual self-attestation at bestpractices.dev. Note it; don't auto-apply. |
| **Signed-Releases** | N/A if the repo doesn't publish releases; otherwise needs cosign/attestation work — propose, don't auto-apply. |

If a check isn't in any table, link [the check docs](https://github.com/ossf/scorecard/blob/main/docs/checks.md) and ask — don't guess a fix.

## Step 3 — Write the plan and stop at the approval gate

Write the plan to `scorecard-fix-plan.md` at the repo root (or `.context/` if the
repo keeps scratch there). Structure it exactly as the three buckets, each entry
naming the check, the concrete change, and the files/commands involved:

```markdown
# Scorecard remediation plan — <owner>/<repo>

## A. File changes (will apply on approval)
- [ ] **License** — add MIT `LICENSE` at root (matches package.json + per-skill LICENSEs)
- [ ] **Token-Permissions** — add `permissions: read-all` to ci.yml, release.yml, codex-review.yml
- [ ] **Pinned-Dependencies** — SHA-pin 8 action uses across 3 workflows
- [ ] **Dependency-Update-Tool** — add .github/dependabot.yml (github-actions + npm)
- [ ] **Security-Policy** — add SECURITY.md
- [ ] **SAST** — (optional) add CodeQL workflow — RECOMMEND SKIP: repo is ~95% markdown/shell

## B. Repo settings (needs admin — I'll run these if you say go)
- [ ] **Branch-Protection** — Tier 1 (no force-push / no deletion) on `main`  ← safe
- [ ] **Code-Review** — require 1 review  ← SKIP for solo repo (blocks your own merges)

## C. Won't fix / N/A
- **Maintained** — repo <90 days old; self-heals.
- **Fuzzing** — N/A for a skills repo.
- **CII-Best-Practices** — manual self-attestation; out of scope.
```

Then **stop and ask for approval** before editing anything:

> "Plan written to `scorecard-fix-plan.md`. Apply the bucket-A file changes now? (Bucket B settings I'll run only on your explicit go; bucket C is informational.)"

Accept "yes"/"y"/""/"go" as approval. If the user pre-approved in their message
("fix as many as you can"), treat that as approval for bucket A and for the
**safe** bucket-B items (Tier-1 branch protection), but still surface bucket-B
caveats before running the API calls.

## Step 4 — Apply

**Bucket A:** make the edits. For Pinned-Dependencies, resolve each SHA before
writing — never invent a SHA. Run a syntax check on edited workflows (`actionlint`
if available, else `bash -n`/yaml parse). Do **not** commit; leave the diff for
the user (their commit hook may run format/lint).

**Bucket B:** show the exact `gh api` command and its body, then run it only for
approved, non-disruptive items. Print the rollback command alongside (e.g.
`gh api -X DELETE repos/<owner>/<repo>/branches/<branch>/protection`).

**Bucket C:** nothing to do — already documented in the plan.

## Step 5 — Summarize and point at verification

End with:
- A checklist of what was applied vs. skipped (and why skipped).
- The reminder that the score only changes after the next workflow run lands on
  the default branch — re-run `scorecard-report.sh --fetch` then to confirm.
- If publishing (phase 2) is also in flight, note the first published run is what
  updates scorecard.dev.

## Guidelines

- **Never invent findings or SHAs.** Findings come from the report; SHAs come from `gh api`.
- **Don't commit for the user.** Apply to the working tree; let them commit.
- **Separate score-improving from security-improving.** Token-Permissions and SHA-pinning are real hardening; a `SECURITY.md` that just makes the check pass is paperwork. Say which is which.
- **Respect solo-maintainer reality.** Don't push Code-Review / required-reviews on a one-person repo; it breaks their merge flow for a few points.
- **Optional items stay opt-in.** CodeQL/SAST on a docs-heavy repo is noise — recommend skipping unless the user wants it.
