---
name: security-openssf
description: Scaffold OpenSSF Scorecard GitHub Action on a public repo with a safe two-phase rollout — first run with publish_results false so SARIF findings can be triaged before any score reaches the public dashboard, then flip to true and add a badge once the score is acceptable. Refuses to install on private/internal repos. Use when the user says "add OpenSSF", "set up Scorecard", "OpenSSF boilerplate", or "/security-openssf".
---

# security-openssf

You are adding the [OpenSSF Scorecard](https://github.com/ossf/scorecard) GitHub Action to the current repo and walking the user through a **two-phase rollout** so a poor first score never lands on the public dashboard:

1. **Phase 1 — Trial run.** Install the workflow with `publish_results: false`. Results stay private in the repo's Security tab (SARIF). The user triages findings without anyone outside the repo seeing the score.
2. **Phase 2 — Go public.** Flip `publish_results: true` and add the scorecard badge to the README so the live score is visible at `scorecard.dev`.

This skill stops between phases. Do not flip to phase 2 in the same session unless the user explicitly asks — the gap is the whole point.

## When to use

- "add OpenSSF [Scorecard] to this repo"
- "set up Scorecard" / "scorecard action"
- "OpenSSF boilerplate" / "/security-openssf"
- User pastes a scorecard.dev URL and wants the same setup

## Hard prerequisites — check before doing anything

```bash
# 1. We're in a git repo with a GitHub remote
gh repo view --json visibility,defaultBranchRef,nameWithOwner 2>/dev/null \
  || { echo "Not a GitHub repo (or gh not authed). Abort."; exit 1; }
```

Capture:
- `VISIBILITY` (`PUBLIC` / `PRIVATE` / `INTERNAL`)
- `DEFAULT_BRANCH` (most often `main`)
- `REPO` (`owner/name`)

**Visibility gate — refuse on private/internal repos. No exceptions.**

| Repo visibility | Action |
|-----------------|--------|
| Public          | Proceed with phase 1. |
| Private / Internal | **Refuse. Stop.** |

Empirically verified on a real private repo: the Scorecard action hard-fails before producing any SARIF —

```
scorecard had an error: internal error: ListCommits:
  error during graphqlHandler.setup:
  internal error: githubv4.Query: Resource not accessible by integration
```

The default `GITHUB_TOKEN` can't run the GraphQL queries Scorecard needs against a private repository. A fine-grained PAT via the action's `repo_token` input works around this, but adding that complexity defeats the point of a boilerplate, and the public-score outcome still doesn't apply. Don't install it.

If the repo is private/internal, say:

> This repo is private. Scorecard hard-fails on private repos under the default GitHub token (`Resource not accessible by integration`), and the public scorecard.dev dashboard refuses private repos either way — installing the workflow now would just generate weekly failure emails. Re-run /security-openssf after you flip the repo to public.

That's it — no install, no escape hatches, end the session.

## Phase 1 — Install the trial workflow

### 1. Pin the action to a commit SHA, not a tag

Tag-pinning (`@v2`) is the Scorecard tutorial default but is itself a low-Pinned-Dependencies finding *that the workflow you're installing will flag*. Resolve a recent release SHA up front:

```bash
gh release view --repo ossf/scorecard-action --json tagName,targetCommitish
# Then resolve the tag to its full SHA:
gh api repos/ossf/scorecard-action/git/refs/tags/<tagName> --jq '.object.sha'
```

Record both `<SHA>` and `<tagName>` — write the SHA into the workflow and the tag as a comment so Dependabot can still recognize and bump it.

If the user pushes back on SHA-pinning (some teams prefer the tag), respect that — note the trade-off and use the tag.

### 2. Write `.github/workflows/scorecard.yml`

Use the template at `assets/scorecard.yml`. Substitute:

- `__DEFAULT_BRANCH__` → captured default branch (e.g. `main`)
- `__SCORECARD_SHA__` → resolved commit SHA
- `__SCORECARD_TAG__` → human-readable tag (in the trailing comment)
- `publish_results` stays `false` for phase 1

Create the directory if needed:

```bash
mkdir -p .github/workflows
```

Show the user the file you're about to write, then write it. Do NOT commit — let the user commit when they're ready. (Their commit hook may run lint/format first; respect that.)

### 3. Explain what runs and what they'll see

After the user pushes the workflow, on the next push to the default branch and weekly thereafter:

- The job runs in their own Actions minutes (free on public repos).
- It writes a SARIF file and uploads it to the repo's **Security → Code scanning** tab. That's where the findings live during phase 1.
- The aggregate score is in the Actions log under "Scorecard analysis results" — surface where to look so the user doesn't go hunting.

### 4. Stop here.

End the session with a short summary and a clear "next step" for the user:

```
Wrote .github/workflows/scorecard.yml  (publish_results: false)

What to do next:
  1. Commit & push the workflow on a branch.
  2. Merge to <default-branch> — Scorecard only runs on the default branch.
  3. Wait for the first run. Open Actions → Scorecard analysis → log to see the score.
  4. Open Security → Code scanning to see per-check findings as SARIF.
  5. Triage the findings (this skill can help in a second session).
  6. When the score is acceptable, re-invoke /security-openssf and ask to go public.
```

Do not loop into phase 2 the same session. The whole point is to let the workflow actually run and the user actually look at the output.

## Triage assistance (interstitial, optional)

If the user comes back mid-rollout asking "what does this finding mean" or "how do I fix Token-Permissions", help them on a per-check basis. The high-impact, low-effort fixes — in roughly the order users want to tackle them:

| Finding | Typical fix |
|---------|-------------|
| **Token-Permissions** | Add `permissions: read-all` (or scoped per-job) to every workflow. One line, no behavior change. |
| **Pinned-Dependencies** | Pin Actions to commit SHAs. Dependabot can do this with `package-ecosystem: github-actions`. |
| **Dangerous-Workflow** | Audit for `pull_request_target` + checkout of PR head. Replace with `pull_request` or split into two workflows. |
| **Branch-Protection** | Enable required reviews + status checks on the default branch via repo settings. |
| **Code-Review** | Enforce 1+ reviewer in branch protection. Solo-maintainer repos legitimately can't pass this; that's OK. |
| **Security-Policy** | Add a `SECURITY.md` at repo root with a contact channel. |
| **Signed-Releases** | Sign release artifacts via `cosign` or use `gh release create` with attestation. Skip if the repo doesn't publish releases. |
| **Dependency-Update-Tool** | Add a one-file `.github/dependabot.yml` with the relevant package-ecosystems. |
| **CII-Best-Practices** | Self-attestation at [bestpractices.coreinfrastructure.org](https://www.bestpractices.dev/). Easy +score if the project is mature. |
| **Fuzzing / SAST** | These are high-effort and often legitimately not applicable. Don't push the user to fake them. |

Some checks (Maintained, Vulnerabilities, License, Contributors, Binary-Artifacts, Packaging, Webhooks) are derived from repo state, not workflow config — they're either passing or they aren't, and the fix is project-shape work, not a YAML edit.

When advising on fixes, **separate the score-improving change from the security-improving change**. Enabling `permissions: read-all` actually makes the workflow safer. "Adding a `SECURITY.md` so the check passes" is paperwork. The user is entitled to both, but they should know which is which.

## Phase 2 — Flip to public

Only enter this phase when the user explicitly asks (e.g. "go public", "publish results", "phase 2"). Confirm three things before editing:

1. **Repo is public.** Re-check `gh repo view --json visibility`. If it's flipped to private since phase 1, refuse — `publish_results: true` will fail the job.
2. **At least one phase-1 run completed.** `gh run list --workflow=scorecard.yml --limit 1` should show a successful run. If it never ran, the phase-1 install is broken; fix that before publishing.
3. **The user is OK with the current score landing on scorecard.dev.** Pull the score from the most recent run and show it to them:

   ```bash
   gh run view --workflow=scorecard.yml --log | grep -E 'Aggregate score|^Score' | head
   ```

   If the score is below ~5, ask explicitly: "This will be publicly visible at scorecard.dev/viewer/?uri=github.com/<repo>. Proceed?"

### Edit the workflow

Two changes to `.github/workflows/scorecard.yml`:

1. `publish_results: false` → `publish_results: true`
2. Ensure `id-token: write` is present under `permissions:` (the template already has it — verify it wasn't removed during triage). This is required for OIDC signing of the published result.

Show the diff before writing.

### Add the badge to README

After the next workflow run on the default branch publishes results, the badge URL is:

```markdown
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/__REPO_OWNER__/__REPO_NAME__/badge)](https://scorecard.dev/viewer/?uri=github.com/__REPO_OWNER__/__REPO_NAME__)
```

Substitute the captured `<owner>/<name>`. Drop it near the top of the README, alongside any existing CI/license badges. Show the diff; let the user commit.

Note: the badge will 404 until the *first published* run completes — usually a few minutes after merge. Tell the user this so they don't think the badge is broken.

### End-of-phase-2 summary

```
Flipped publish_results → true.
Badge added to README.

After your next push to <default-branch>:
  - Scorecard publishes to https://scorecard.dev/viewer/?uri=github.com/<repo>
  - Badge in README will resolve once the published run completes (~5 min after the workflow finishes)

To roll back: revert this commit. The dashboard entry will go stale (no new
data) but old scores remain visible — you cannot un-publish historical scores.
```

The irreversibility of historical publication is the single thing the user most needs to know before they merge phase 2.

## Edge cases

- **Repo has no default branch yet** (fresh repo). Scorecard can't run. Tell the user to push at least one commit to `main` first.
- **Org disables third-party Actions.** The workflow will fail with a permissions error. Surface this immediately — the fix is an org-level setting, not a workflow edit.
- **Repo is a fork.** Scorecard works but `publish_results: true` is wasted effort — scorecard.dev keys on the canonical repo. Recommend skipping; if the user insists, phase 1 only.
- **User insists on private/internal install.** Refuse. The visibility-gate explanation above is the answer — paraphrase, don't re-litigate.
- **Repo already has a `scorecard.yml`** under `.github/workflows/`. Read it, diff against the template, and ask before overwriting. The user may have customized it.
- **User asks for `--fix` automation** to address findings. Out of scope for this skill — point at the per-check fixes above and let them open PRs.

## Guidelines

- Do not commit on the user's behalf. Write the file, show the diff, let them commit.
- Do not flip `publish_results: true` without the gates in phase 2. A bad first public score is hard to unwind because old scores remain in the dashboard history.
- Pin to a SHA, comment the tag. If the user objects, note the trade-off and use the tag.
- Do not invent fixes for checks you don't understand. If a finding's resolution isn't in the table above, say so and link the user to [the check docs](https://github.com/ossf/scorecard/blob/main/docs/checks.md) rather than guessing.
