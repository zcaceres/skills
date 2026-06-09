---
name: security-socket
description: Set up Socket Security (socket.dev) on a repo. The integration is a GitHub App, not a config file, so most of the skill is walking the user through the OAuth install in two browser steps (socket.dev sign-in, then GitHub App install) and then verifying via the GitHub API that the install actually landed on the right account and the current repo is in the selected-repos list. Optionally scaffolds a pinned CI workflow as a status-check backstop to the App's PR comments. User-triggered only — activate when the user invokes `/security-socket`.
---

# security-socket

You are setting up [Socket Security](https://socket.dev) on the current repo. Socket's integration is a GitHub App, not a checked-in config file. The skill's job is:

1. Walk the user through the two-step web install (socket.dev OAuth + GitHub App install screen).
2. **Verify** via the GitHub API that the App is installed on the right account *and* that the current repo is in its selected-repos list — the common failure mode is "I clicked install but picked the wrong account" or "I forgot to add this repo to the selected list."
3. (Optional) scaffold a pinned CI workflow as a status-check backstop.

Most of this skill is talking, not file-writing. Don't try to automate the browser steps — the OAuth flow needs the user's actual GitHub session.

## When to use

User-triggered only. Activate when the user invokes `/security-socket`. Do not self-activate on related natural-language phrasing ("add socket", "set up socket", a mention of typosquats or risky deps) — surface the slash command to the user instead and let them decide.

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

**Visibility note.** Socket's free tier works on both public and private repos (unlike OpenSSF Scorecard — see [[security-openssf]] for that gate). No refusal here.

## Phase 1 — Walk the user through the install

Print the steps and stop. Don't try to do anything for the user in this phase; the OAuth flow doesn't work without their browser.

```
1. Open https://socket.dev/ → click "Sign in with GitHub" (top right).
2. Authorize the OAuth app (read-only profile info — this is just the login,
   not the scanning install).
3. On the Socket dashboard, click "Add repositories" → it sends you to
   https://github.com/apps/socket-security to install the GitHub App.
4. On the GitHub install screen:
   - Pick the account that owns __OWNER__ (your personal account, not an
     org, unless this repo lives in an org).
   - Select "Only select repositories".
   - Make sure __REPO__ is in the list. Add others if you want.
   - Click Install (or "Install & Authorize" if it's the first time).
5. You'll land back on socket.dev showing the repo in the dashboard.

Tell me when you're done — I'll verify the install via the GitHub API.
```

Substitute `__OWNER__` and `__REPO__` with the captured values. Then wait.

Common stumbles to call out *up front* so the user doesn't get stuck:

- **Multiple GitHub accounts.** The OAuth flow uses whichever GitHub session is active in their browser. If they're signed in as the wrong account, Socket will install on the wrong account. The verification phase will catch this.
- **Org-owned repos.** Installing on a personal account when the repo lives in an org doesn't help — Socket needs to be installed on the org. Org admins may have to approve the App.
- **"Only select repositories" vs "All repositories".** All-repositories is fine but the App will silently start scanning every other repo in the account. Most users want the curated list.

## Phase 2 — Verify the install

Once the user says they finished, run the verification. Two things to confirm:

1. The `socket-security` App is installed on the account that owns this repo.
2. The current repo is in that installation's selected-repos list (or the install covers "all repositories").

```bash
# Step 1: list the App installations the authenticated gh user can see.
# The Socket Security App's slug is "socket-security".
gh api --paginate /user/installations \
  --jq '.installations[] | select(.app_slug == "socket-security")
        | {id: .id, account: .account.login, target_type: .target_type,
           repository_selection: .repository_selection}'
```

Expected output if the install landed:
```json
{
  "id": 12345678,
  "account": "<owner>",
  "target_type": "User",
  "repository_selection": "selected"
}
```

If the JQ filter returns *nothing*, the App isn't installed under any account this token can see. Likely causes (in priority order):

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Empty output | User clicked through OAuth login but never reached the GitHub install screen | Re-do step 3 of phase 1 — the "Add repositories" link |
| Empty output, repo is in an org | App was installed on personal account, repo is in an org | Install on the org from https://github.com/apps/socket-security (may need org-admin approval) |
| Empty output, `gh auth status` shows wrong account | gh is authed as a different GitHub user than the browser session | `gh auth switch` to the matching account, re-run |

If output appears but `account` ≠ `OWNER` (e.g. installed on personal account, repo is in an org): tell the user explicitly *which* account it landed on and link them back to the install screen for the correct account.

```bash
# Step 2: if the install exists and `repository_selection == "selected"`,
# confirm the current repo is in the selected list.
INSTALLATION_ID=<id from step 1>
gh api --paginate "/user/installations/$INSTALLATION_ID/repositories" \
  --jq ".repositories[] | select(.full_name == \"$REPO\") | .full_name"
```

If this prints `OWNER/NAME`, the install is good. If it's silent, the App is installed on the right account but this repo isn't in its selected list — point the user at https://github.com/apps/socket-security and have them click "Configure" → add this repo.

If `repository_selection == "all"`, skip step 2 — the App covers every repo on the account, including this one.

### Socket is silent until the next dep change

Surface this so the user doesn't think Socket is broken:

> Socket only comments on PRs that *change a dependency manifest*
> (`package.json`, `requirements.txt`, `pyproject.toml`, `Gemfile`, etc.).
> A PR that only edits source code won't trigger a comment. To see the App
> work, open a PR that bumps or adds a dep — even a no-op patch bump will do.

## Phase 3 (optional) — Scaffold a pinned CI workflow

The GitHub App's PR comment is the primary surface. A CI workflow on top is **redundant for most users** — Socket's App already runs on every PR, on every commit, automatically. Offer the workflow only if the user wants one of:

- A **required status check** for branch protection (the App's comment is just a comment; it can't gate merges).
- A scan that runs even when **collaborators force-push** to a stacked branch (the App handles this, but some users want a belt-and-braces in their own CI).
- A scan they can **reproduce locally** with the same command (the workflow doubles as documentation).

Ask first: "The GitHub App already comments on PRs — a CI workflow is mostly redundant. Want one anyway, e.g. for a required status check?" If no, skip to Phase 4.

### Add the workflow

Use the template at `assets/socket.yml`. Substitute:

- `__DEFAULT_BRANCH__` → captured default branch (e.g. `main`)
- `__SOCKET_CLI_VERSION__` → pinned Socket CLI version (see below)

To resolve the current CLI version:

```bash
npm view socket version
# Example: 1.0.45
```

Show the user the resolved version, then write the file:

```bash
mkdir -p .github/workflows
```

Write to `.github/workflows/socket.yml`. Show the diff before writing.

### Add the API key as a repo secret

The CLI needs a Socket API key. Walk the user through it — this is one-time, not file-writable:

```
1. Open https://socket.dev/dashboard → top right avatar → API tokens.
2. Create a new token (read-only is enough for `socket scan create`).
3. Pipe it into `gh secret set` so the token never lands in shell history:

     gh secret set SOCKET_SECURITY_API_KEY --repo __REPO__
     # paste the token when prompted, then press Ctrl-D
```

If `gh secret set` errors (`Resource not accessible by integration` on org repos), the user has to set the secret via the GitHub web UI instead — Settings → Secrets and variables → Actions → New repository secret.

### Why we install the CLI directly, not a marketplace action

Socket publishes their CLI to npm. Installing via `npm i -g socket@<pinned>` keeps the version pin visible in the workflow diff and avoids a third-party action in the supply chain. If the user wants the marketplace action (`SocketDev/socket-security-action` or current equivalent) for CODEOWNERS / Dependabot reasons, respect that — note the trade-off and swap in the action pinned to a commit SHA.

## Phase 4 (optional) — Install the CLI locally

For pre-push scans without going through CI:

```bash
npm i -g socket@<version>
socket login         # opens browser, stores a token in ~/.socket/
socket scan create . # scans the working tree's manifests
```

Skip unless the user asks. Most users will rely on the App's PR comments.

## End-of-session summary

```
Socket Security install verified for __REPO__.

Verified:
  ✓ GitHub App "socket-security" installed on __OWNER__
  ✓ __REPO__ is covered by the installation
  [✓ CI workflow .github/workflows/socket.yml committed (if Phase 3)]
  [✓ SOCKET_SECURITY_API_KEY secret set on __REPO__ (if Phase 3)]

What to do next:
  - Socket will comment on the next PR that touches a dependency manifest
    (package.json, requirements.txt, etc.). PRs that only edit source code
    won't trigger a comment — that's expected.
  - Dashboard: https://socket.dev/dashboard
  - To turn the App's comment into a required check, configure branch
    protection on __DEFAULT_BRANCH__ to require the "socket-security"
    status (App PR comments don't gate merges on their own).
```

## Triage assistance (interstitial, optional)

If the user comes back later asking about a specific Socket finding:

| Finding type | What it means | What to do |
|--------------|---------------|------------|
| **Typosquat** | New dep name is one Levenshtein step from a popular package | Almost always a real concern. Reject the PR; confirm intent of the package author. |
| **Install scripts** | Package runs code at install time (`postinstall` etc.) | Audit what the script does. Common in build-tool packages (`esbuild`, `node-gyp`); suspicious in random utilities. |
| **Native code** | Package ships compiled `.so` / `.dylib` / `.node` binaries | Verify it's expected (`sharp`, `better-sqlite3`); flag if a pure-JS utility suddenly grows native code. |
| **Telemetry / network** | Package phones home | Check the destination. Telemetry to the maintainer's analytics may be acceptable; arbitrary POSTs are not. |
| **Unmaintained** | No commits / releases in N years | Often a false alarm on stable utilities. Weight by what the package does — a string-pad library being "unmaintained" is fine; a crypto library being unmaintained is a smell. |
| **High risk score, no specifics** | Aggregate of several signals, none individually severe | Click through to the dep page on socket.dev. The breakdown matters more than the score. |

When advising on findings, point the user at the specific finding's URL on socket.dev rather than re-explaining what Socket already says on the PR comment. The dashboard has more detail than the comment.

## Edge cases

- **Repo lives in an org with restricted GitHub App installs.** The user can't install Socket themselves; an org admin has to approve. Surface this as a Phase 2 verification failure and point them at "request installation" on the GitHub install screen.
- **Repo has existing `.github/workflows/socket.yml`.** Read it, diff against the template, ask before overwriting. The user may already be running Socket via CI.
- **Repo uses a non-npm ecosystem only (e.g. pure Rust, Go).** Socket scans `package.json`, `requirements.txt`, `pyproject.toml`, `Gemfile`, `Cargo.toml`, `go.mod` — most ecosystems are covered. If the user's stack is exotic, check Socket's [supported ecosystems list](https://docs.socket.dev) and tell them which manifests will trigger scans.
- **Monorepo with multiple manifests.** Socket walks the tree by default — no extra config needed. The PR comment groups findings by manifest path.
- **User installed Socket on "All repositories" globally.** Phase 2 step 2 is unnecessary — the install covers everything. Tell them so they can stop hunting in the selected-repos list.

## Guidelines

- Don't try to automate the OAuth flow — it needs the user's browser session. Print steps, wait, verify.
- Always verify the install via `gh api /user/installations` before declaring success. "I clicked through it" ≠ "it's installed on the right account."
- Don't write the CI workflow by default — it's redundant with the App. Offer it only when the user has a reason (required status check, force-push coverage, local reproducibility).
- Pin CLI versions in any workflow you write. Floating versions turn "added a scan" into "scan broke and nobody noticed."
- Don't commit on the user's behalf. Write files, show diffs, let them commit.

## Related

- [[quality-snyk]] — vulnerability-scanning sibling, similar GitHub-App-then-CLI shape. Socket and Snyk overlap somewhat (both flag risky deps) but lean different ways: Socket on supply-chain signals (typosquats, install scripts, telemetry), Snyk on known CVEs. Many teams run both.
- [[quality-gitleaks]] — secret-scanning sibling.
- [[security-openssf]] — repo-hygiene scoring sibling.
