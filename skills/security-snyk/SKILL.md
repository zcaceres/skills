---
name: security-snyk
description: Set up Snyk on a repo. The integration is a GitHub App plus a Snyk-side "import this repo as a project" step, not a checked-in config, so most of the skill is walking the user through the three browser steps (Snyk login → GitHub App install → Add project) and then verifying via the GitHub API that the App actually landed on the right account. Pre-flips "Automatic fix PRs" off so the install doesn't dump a backlog of fix PRs into the repo. Optionally scaffolds a pinned CI workflow that runs `snyk code test` (SAST), which isn't covered by the App's free tier dependency-CVE scanning. User-triggered only — activate when the user invokes `/security-snyk`.
---

# security-snyk

You are setting up [Snyk](https://app.snyk.io) on the current repo. Snyk's integration is two things, not one:

1. A **GitHub App** (`snyk-io`) that gives Snyk read access to the repo.
2. A **Snyk-side "project import"** step that tells Snyk which of the App-accessible repos to actually scan.

Most users skip step 2 the first time, install the App, see nothing happen, and assume Snyk is broken. The skill's job is:

1. Walk through Snyk login → GitHub App install → Add project.
2. **Verify** the GitHub App install via the GitHub API.
3. Pre-disable "Automatic fix PRs" so the import doesn't blow up the user's PR list (Snyk is opinionated and chatty by default — this skill is opinionated about *not* being chatty).
4. (Optional) scaffold a pinned CI workflow that runs `snyk code test` for SAST coverage that the App alone doesn't provide on the free tier.

Most of this skill is talking, not file-writing. Don't try to automate the OAuth flow — it needs the user's browser session.

## When to use

User-triggered only. Activate when the user invokes `/security-snyk`. Do not self-activate on related natural-language phrasing ("add snyk", "set up snyk", a mention of CVE scanning, etc.) — surface the slash command to the user instead and let them decide.

## Hard prerequisites — check before doing anything

```bash
# 1. We're in a git repo with a GitHub remote
gh repo view --json nameWithOwner,defaultBranchRef,visibility 2>/dev/null \
  || { echo "Not a GitHub repo (or gh not authed). Abort."; exit 1; }
```

Capture:
- `REPO` (`owner/name`)
- `OWNER` and `NAME` separately (the App-install verification needs them)
- `DEFAULT_BRANCH` (only needed if the user opts into the CI workflow)
- `VISIBILITY` (`PUBLIC` / `PRIVATE` / `INTERNAL`)

**Visibility note.** Snyk's free tier works on public and private repos. No refusal here. (Unlike [[security-openssf]], which refuses on private repos because the OpenSSF Scorecard action hard-fails there.)

## Phase 1 — Walk the user through the install

Print the steps and stop. Don't try to do anything for the user in this phase; the OAuth flow doesn't work without their browser.

```
1. Open https://app.snyk.io/login → click "Sign in with GitHub".
2. Authorize. You'll land in a Snyk org named after your GitHub handle.

3. Left sidebar → Integrations → GitHub → "Connect" (this is a SEPARATE step
   from the login OAuth; the login OAuth doesn't install the scanning App).
4. On the GitHub install screen:
   - Pick the account that owns __OWNER__.
   - Select "Only select repositories".
   - Make sure __REPO__ is in the list.
   - Click "Install & Authorize".

5. Back in Snyk: sidebar → Projects → "Add projects" → pick __REPO__ from the
   list → "Add selected repositories".
   (This is the step everyone misses. The App being installed is not enough.)

6. Snyk imports the repo and scans it. The first scan can take a few minutes.

Tell me when you're done — I'll verify the GitHub App install via the API and
walk you through the noise-tuning step (turning off Automatic fix PRs).
```

Substitute `__OWNER__` and `__REPO__`. Then wait.

Common stumbles to call out *up front*:

- **Login OAuth vs scanning App.** Step 1's OAuth just lets you sign into Snyk. Step 3 is a *separate* install that grants Snyk read access to your code. Skipping step 3 means Snyk has no idea your repos exist.
- **App installed but no project imported.** Step 5 (Add projects) is what tells Snyk to actually scan. The App without a project import is silent.
- **Org-owned repos.** Snyk needs to be installed on the org if the repo lives there. Org admins may have to approve the App.

## Phase 2 — Verify the GitHub App install

Once the user says they finished, verify the App side via the GitHub API. Two things to confirm:

1. The `snyk-io` App is installed on the account that owns this repo.
2. The current repo is in that installation's selected-repos list (or the install covers "all repositories").

```bash
# Step 1: list the App installations the authenticated gh user can see.
# The Snyk App's slug is "snyk-io". (Some older docs reference "snyk" —
# match either to be safe.)
gh api --paginate /user/installations \
  --jq '.installations[] | select(.app_slug | startswith("snyk"))
        | {id: .id, slug: .app_slug, account: .account.login,
           target_type: .target_type,
           repository_selection: .repository_selection}'
```

Expected output if the install landed:
```json
{
  "id": 12345678,
  "slug": "snyk-io",
  "account": "<owner>",
  "target_type": "User",
  "repository_selection": "selected"
}
```

If the JQ filter returns *nothing*, the App isn't installed under any account this token can see. Likely causes:

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Empty output | User did the login OAuth but skipped the Integrations → GitHub Connect step | Re-do step 3 of phase 1 |
| Empty output, `gh auth status` shows wrong account | gh is authed as a different GitHub user than the browser session | `gh auth switch`, re-run |

If output appears but `account` ≠ `OWNER`: surface *which* account it landed on and link the user back to the Snyk Integrations page to install on the correct account.

```bash
# Step 2: if the install exists and `repository_selection == "selected"`,
# confirm the current repo is in the selected list.
INSTALLATION_ID=<id from step 1>
gh api --paginate "/user/installations/$INSTALLATION_ID/repositories" \
  --jq ".repositories[] | select(.full_name == \"$REPO\") | .full_name"
```

If this prints `OWNER/NAME`, the App side is good. If silent, the App is on the right account but this repo isn't in its selected list — point the user at https://github.com/apps/snyk-io and have them click "Configure" → add this repo.

### What this skill can't verify

The GitHub API can tell you the App is installed. It **can't** tell you whether the user finished step 5 (Add projects) on the Snyk side — that requires a Snyk API token. Ask explicitly:

> Did the "Add projects" step on the Snyk side complete? You should see
> __REPO__ under sidebar → Projects in https://app.snyk.io. If not, that's
> the step everyone misses — go back to phase 1 step 5.

If the user wants the agent to verify the Snyk side via API (one-time setup): instruct them to create a personal Snyk API token at https://app.snyk.io/account, then `gh secret set SNYK_TOKEN` (or stash in `op` via [[safety-op-creds]]) and the agent can hit `https://api.snyk.io/rest/orgs/<org>/projects` to confirm. This is overkill for most setups — just ask.

## Phase 3 — Pre-disable "Automatic fix PRs"

This is a default-Snyk-behavior trap: as soon as a project is imported, Snyk starts opening PRs to bump vulnerable deps. On a repo with any history of stale deps, this means a wave of unsolicited PRs landing in the user's inbox.

Snyk doesn't expose this toggle via a public API (it's a UI-only setting on the integration object as of writing). Walk the user through it manually:

```
1. Open https://app.snyk.io → Settings (cog icon, top right).
2. Integrations → GitHub.
3. Find "Automatic fix PRs" or "Pull request creation for fix advice".
   Toggle it OFF.
4. Confirm "PR Checks" stays ON — that's the useful one. It scans new PRs
   and reports findings as a status check, without opening fix PRs.
5. Save.
```

Verify it stuck by asking the user to refresh the page and check the toggle state. Snyk's UI has been known to silently revert preferences in the past.

If the user actively *wants* automatic fix PRs (some teams use them as Dependabot replacement), say so and skip — leave the toggle on. This skill is opinionated about defaults, not religious about them.

## Phase 4 (optional) — Scaffold a pinned CI workflow for `snyk code test` (SAST)

Snyk's GitHub App on the free tier scans dependencies for known CVEs. It does **not** run `snyk code test` (the SAST product) on PRs by default — that requires either a paid plan or a CI invocation with an API token. The CI workflow fills this gap.

If the user only cares about dependency CVEs, skip this phase — the App covers it. Ask first: "Want SAST coverage on PRs? The App's free tier handles dep CVEs but not source-code SAST. A CI workflow runs `snyk code test` on every PR — costs one of your ~100-200 monthly Snyk Code tests per run."

If yes:

### Add the workflow

Use the template at `assets/snyk.yml`. Substitute:

- `__DEFAULT_BRANCH__` → captured default branch
- `__SNYK_CLI_VERSION__` → pinned Snyk CLI version (see below)

To resolve the current CLI version:

```bash
npm view snyk version
# Example: 1.1297.0
```

Write to `.github/workflows/snyk.yml`:

```bash
mkdir -p .github/workflows
```

Show the diff before writing.

### Add the API token as a repo secret

```
1. Open https://app.snyk.io/account → "Auth token" section → copy.
2. Pipe it into `gh secret set` so the token never lands in shell history:

     gh secret set SNYK_TOKEN --repo __REPO__
     # paste the token when prompted, then press Ctrl-D
```

If `gh secret set` errors (`Resource not accessible by integration` on org repos), the user has to set the secret via the GitHub web UI: Settings → Secrets and variables → Actions → New repository secret.

### Why we install the CLI directly, not the marketplace action

Snyk publishes their CLI to npm. Installing via `npm i -g snyk@<pinned>` keeps the version pin visible in the workflow diff and avoids a third-party action in the supply chain. If the user wants the marketplace action (`snyk/actions/node` or current equivalent) for CODEOWNERS / Dependabot reasons, respect that — note the trade-off and swap in the action pinned to a commit SHA.

### Why `snyk code test`, not `snyk test`

- `snyk test` — dependency CVEs. The App already does this on every PR (via "PR Checks"). Running it in CI too is mostly duplicate work.
- `snyk code test` — source-code SAST (taint analysis, insecure patterns). **Not** covered by the App on free tier. This is the gap the workflow fills.

If the user wants both (dep CVEs *and* SAST) in one workflow, run both commands — but the dep result will overlap with the App's PR Check. Note the duplication and let them decide.

## Phase 5 (optional) — Install the CLI locally

For pre-push scans without going through CI:

```bash
npm i -g snyk@<version>
snyk auth         # opens browser
snyk test         # dependency CVEs
snyk code test    # SAST
```

Skip unless the user asks.

## End-of-session summary

```
Snyk install verified for __REPO__.

Verified via GitHub API:
  ✓ GitHub App "snyk-io" installed on __OWNER__
  ✓ __REPO__ is covered by the installation
Verified manually (need user confirmation):
  ✓ __REPO__ added as a Snyk project (sidebar → Projects)
  ✓ "Automatic fix PRs" toggled OFF in Snyk integration settings
  [✓ CI workflow .github/workflows/snyk.yml committed (if Phase 4)]
  [✓ SNYK_TOKEN secret set on __REPO__ (if Phase 4)]

What to do next:
  - Snyk will run "PR Checks" on the next PR. Findings appear as a status
    check on the PR and in https://app.snyk.io → Projects → __REPO__.
  - Pre-existing CVEs from before today will be visible in the Snyk dashboard
    as a backlog. Filter by severity = High/Critical, then by "fixable" —
    most of the rest is low-priority noise.
  - To turn the Snyk PR Check into a required check, configure branch
    protection on __DEFAULT_BRANCH__ to require the relevant status.
```

## Triage assistance (interstitial, optional)

If the user comes back later asking about Snyk findings:

| Finding type | What it means | What to do |
|--------------|---------------|------------|
| **High-severity CVE, fix available** | Vulnerable dep version pinned, a non-vulnerable version exists | Bump the dep. If Snyk's PR Check shows the exact "Upgrade `foo` to `1.2.3+`" advice, take it. |
| **High-severity CVE, no fix** | Vulnerable dep version pinned, no patched version yet | Check Snyk's "Exploit Maturity" rating. "Mature" exploit + your code path uses the vulnerable function = real problem; otherwise note and watch. |
| **High-severity CVE in a transitive dep** | Vulnerability in a dep-of-a-dep | Check if your direct dep has an updated version that pulls a patched transitive. If not, `overrides` (npm) / `resolutions` (yarn) can force a fix — but verify nothing breaks. |
| **Snyk Code: SQL injection / XSS / etc.** | Snyk Code's SAST flagged a code path | Look at the flagged file:line. SAST has false positives, especially around taint sinks the analyzer doesn't understand — but treat as real until you can show it's not. |
| **License finding** | Dep uses a license that violates org policy | Out of scope for fix-this-PR. Surface to whoever owns license compliance. |
| **Devops drift** | Snyk Container / IaC scanning a Dockerfile / k8s manifest | If the repo doesn't ship containers, mute the integration. Otherwise treat like a SAST finding on the manifest. |

When advising on findings, point the user at the specific finding's URL in the Snyk dashboard rather than re-explaining what Snyk already says. The dashboard has more detail than the PR Check comment.

## Edge cases

- **Repo lives in an org with restricted GitHub App installs.** The user can't install Snyk themselves; an org admin has to approve. Surface this as a Phase 2 verification failure and point them at "request installation" on the GitHub install screen.
- **Repo has existing `.github/workflows/snyk.yml`.** Read it, diff against the template, ask before overwriting. The user may already be running Snyk via CI.
- **Repo has a `.snyk` policy file.** This is the file format Snyk uses for "ignore this CVE for N days" / path-scoped suppressions. Don't delete or rewrite — it's user-managed.
- **Monorepo with multiple manifests.** Snyk's "Add projects" import detects manifests across the tree by default. If the user only wants a subset scanned, they can deselect individual manifests during the project-add step (or after, via the project settings).
- **User insists on automatic fix PRs.** Respect it. Skip Phase 3. Document the choice in the end-of-session summary.
- **Repo is Java/Go/Rust/exotic.** Snyk supports many ecosystems including JVM, Go, Rust, Python, .NET. The dependency-CVE side works the same way. SAST (`snyk code test`) supports a narrower set — check Snyk's [supported languages list](https://docs.snyk.io) before scaffolding Phase 4.

## Guidelines

- Don't try to automate the OAuth flow — it needs the user's browser session. Print steps, wait, verify.
- Always verify the App side via `gh api /user/installations` before declaring success. "I clicked through it" ≠ "the right App is installed on the right account."
- Always ask the user to confirm the Snyk-side project import (step 5 of phase 1). The agent can't verify it via the GitHub API.
- Pre-disable Automatic fix PRs by default. The opt-out is explicit — don't skip it silently.
- Pin CLI versions in any workflow you write. Floating versions turn "added a scan" into "scan broke and nobody noticed."
- Don't commit on the user's behalf. Write files, show diffs, let them commit.

## Related

- [[security-socket]] — supply-chain risk sibling, similar GitHub-App-then-CLI shape. Socket leans on supply-chain signals (typosquats, install scripts, telemetry); Snyk leans on known CVEs. Many teams run both — they overlap a little but mostly catch different things.
- [[security-gitleaks]] — secret-scanning sibling.
- [[security-openssf]] — repo-hygiene scoring sibling.
- [[safety-op-creds]] — if the user wants to stash `SNYK_TOKEN` in 1Password instead of as a GitHub Actions secret for local CLI use.
