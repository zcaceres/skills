---
name: security-openssf-bestpractices
description: Help a FLOSS project earn the OpenSSF Best Practices passing badge at bestpractices.dev. Audits the repo against the self-certification criteria, closes the common gaps (SECURITY.md, CONTRIBUTING.md, test/build docs), generates a fill-in worksheet of justifications and evidence URLs to paste into the web form, walks through registration, and embeds the badge. Self-attestation — never fabricates a "Met" answer. Use when the user says "OpenSSF Best Practices badge", "bestpractices.dev", "CII badge", "best practices self-certification", or "/security-openssf-bestpractices".
---

# security-openssf-bestpractices

You are helping a Free/Libre/Open-Source (FLOSS) project earn the [OpenSSF Best
Practices Badge](https://www.bestpractices.dev) (the program formerly known as
the CII Best Practices Badge). This is **self-certification**: the project owner
fills in a web questionnaire on `bestpractices.dev` attesting how the project
meets each criterion, and earns a **passing / silver / gold** badge.

**This is not the OpenSSF Scorecard.** Scorecard (the sibling skill
`security-openssf`) is an automated GitHub Action that scores your repo. This
badge is a manual questionnaire you fill out yourself. They are different
OpenSSF programs with confusingly similar names — see the note at the end.
Getting this badge also satisfies Scorecard's `CII-Best-Practices` check, so the
two compose nicely.

This skill targets the **passing** level. Silver and gold exist but are out of
scope for a first pass — mention them only if the user asks.

## What this skill actually does

The badge form lives behind GitHub OAuth and is the user's own legal/reputational
attestation, so **you do not submit it for them.** Your job is everything around
the form:

1. **Audit** the repo against the passing criteria — for each, decide Met /
   Unmet / N/A and find the evidence URL.
2. **Close gaps** — many "Unmet" items are real, small repo improvements
   (add a `SECURITY.md`, a `CONTRIBUTING.md`, document the build/test process).
   Offer to make these.
3. **Generate a worksheet** — a filled-in copy of `assets/passing-criteria-worksheet.md`
   with every criterion's answer, justification text, and evidence URL, ready
   to paste into the web form.
4. **Walk registration** — log in at bestpractices.dev, add the project, paste
   the answers.
5. **Embed the badge** — once the project entry exists it has a numeric ID;
   add the badge markdown to the README.

## When to use

- "get the OpenSSF Best Practices badge" / "bestpractices.dev"
- "CII badge" / "best practices self-certification"
- "what do I need for a passing OpenSSF badge"
- `/security-openssf-bestpractices`

## The honesty rule — read this first

This is a public attestation signed by the project owner. **Never mark a
criterion "Met" on evidence you don't actually have.** Your role is to find and
cite real evidence, not to manufacture green checkmarks. When you can't verify
something from the repo, mark it **Unknown — confirm with maintainer**, never
"Met". A badge built on fabricated answers is worse than no badge: it's a public
claim the project can't back up.

When you do propose a fix, separate the two kinds plainly:

- **Real improvement** — adding a working vulnerability-reporting channel,
  writing actual tests, enabling compiler warnings. The project is genuinely
  better.
- **Paperwork** — wording a `description_good` answer, linking the existing
  issue tracker as the `report_process` URL. Legitimate, but it's documentation,
  not a security change.

The user is entitled to both. They should know which is which.

## Prerequisites — check before doing anything

```bash
gh repo view --json visibility,defaultBranchRef,nameWithOwner,licenseInfo,url 2>/dev/null \
  || echo "Not a GitHub repo (or gh not authed)."
```

Capture: `REPO` (owner/name), `URL`, `DEFAULT_BRANCH`, `VISIBILITY`, `licenseInfo`.

Two soft gates (warn, don't hard-refuse — the user may be mid-setup):

- **Must be FLOSS.** The badge is for open-source projects. If there's no
  OSS license (`licenseInfo` is null / proprietary), say so: most criteria
  (`floss_license`, `repo_public`, `sites_https`) can't honestly be met, and the
  badge doesn't apply to closed source. Offer to help add an OSI license first.
- **Should be publicly readable.** `repo_public` is a MUST. A private repo can
  register but can't truthfully pass. If private, note that the badge only makes
  sense once the repo is public; you can still audit and prep the worksheet now.

Unlike Scorecard, a **solo-maintainer project is fine** — passing has no
required-reviewer criterion. Don't discourage solo maintainers.

## Phase 1 — Audit the repo

Work through the criteria by category using `assets/passing-criteria-worksheet.md`
as your checklist. Inspect the actual repo — don't assume. Useful signals:

| Looking for | Where to check |
|---|---|
| License (`floss_license`, `license_location`) | `LICENSE` / `COPYING` file; `gh repo view --json licenseInfo` |
| Contribution guide (`contribution`, `contribution_requirements`) | `CONTRIBUTING.md`, README "Contributing" section |
| Vulnerability reporting (`vulnerability_report_process`, `_private`) | `SECURITY.md`, GitHub "Report a vulnerability" / private advisories |
| Bug reporting (`report_process`, `report_tracker`, `report_archive`) | GitHub Issues enabled? README "Issues" link? |
| Build (`build`, `build_common_tools`) | `package.json`/`Makefile`/`pom.xml`/`pyproject.toml` + a documented build cmd |
| Tests (`test`, `test_invocation`, `test_policy`, `tests_are_added`) | test dir, CI config, README "Tests" section |
| Warnings (`warnings`, `warnings_fixed`) | linter/compiler flags in CI or build config |
| Static analysis (`static_analysis`, `static_analysis_fixed`) | CodeQL/linters/SAST in `.github/workflows`, pre-commit |
| HTTPS (`sites_https`) | project homepage + repo URL both https |
| Release notes (`release_notes`, `release_notes_vulns`) | `CHANGELOG.md`, GitHub Releases |
| Crypto (`crypto_*`) | does the software implement/call crypto at all? If not → all N/A |

For each criterion record one of:

- **Met** + the exact evidence URL (a permalink to the file/line, the Issues
  page, the SECURITY.md, etc.). Most MUST criteria with `met-url-required`
  *require* a URL — a justification alone won't satisfy the form.
- **N/A** + one-line reason (only where `na-allowed` — the worksheet marks these).
  Crypto criteria are the common case: a project that does no cryptography marks
  the whole `crypto_*` block N/A.
- **Unmet** + what's missing (this becomes Phase 2 work).
- **Unknown — confirm** when you genuinely can't tell. Never guess "Met".

Produce the filled worksheet as a file in the repo (e.g.
`.openssf-badge-worksheet.md`) or print it — ask the user which. Summarize: how
many MUSTs are Met, how many Unmet, what's blocking passing.

## Phase 2 — Close the gaps

Passing requires **all MUST criteria** met (SHOULD criteria need a met-or-justified
answer; SUGGESTED can be left unmet). Walk the Unmet MUSTs in rough order of
impact-per-effort. The frequent offenders and their fixes:

| Unmet criterion | Fix |
|---|---|
| `vulnerability_report_process` / `_private` | Add a `SECURITY.md` (template in `assets/`). Enable GitHub private vulnerability reporting in repo settings → Security. This closes the whole vuln-reporting block, which is multiple MUSTs. |
| `contribution` | Add a `CONTRIBUTING.md` (template in `assets/`). `contribution_requirements` (SHOULD) wants it to state coding/PR requirements. |
| `report_process` / `report_archive` | Ensure GitHub Issues is enabled; the Issues URL is your evidence and archive. |
| `test` / `test_policy` / `tests_are_added` | The project needs at least one automated test and a stated policy that new features get tests. If there are genuinely no tests, **don't fake it** — adding a real test is the fix, even a smoke test. |
| `build` | Document the build/install command in the README (often already true — just needs a URL anchor). `na-allowed` for projects with no build step. |
| `warnings` / `warnings_fixed` | Turn on compiler/linter warnings in CI. `na-allowed` for languages without them. |
| `static_analysis` | Add one static-analysis tool (linter, CodeQL, type-checker) run before releases. `met-justification-required`: the form wants you to name the tool. The sibling `security-openssf` Scorecard skill, or a CodeQL workflow, satisfies this. |
| `release_notes` | Keep a `CHANGELOG.md` or use GitHub Releases with human-readable notes. |
| `know_secure_design` / `know_common_errors` | Self-knowledge attestations — the maintainer affirms they understand secure design / common vuln classes. The form links learning resources. These are honest self-report, not repo edits. |

Use `assets/SECURITY.md.template` and `assets/CONTRIBUTING.md.template` as
starting points. Show the file before writing; **do not commit on the user's
behalf** — let them commit (their hooks may lint/format first).

After each gap closes, update the worksheet entry from Unmet → Met with the new
file's URL.

## Phase 3 — Register and fill the form

The form is at bestpractices.dev and requires the user's own GitHub login —
**they** drive the browser; you supply the answers from the worksheet. Walk them
through it:

1. Go to **https://www.bestpractices.dev** → "Login" → "Login with GitHub" and
   authorize. (Email/password signup also works.)
2. Click **"Get Your Badge Now!"** / "Add New Project".
3. Paste the repo URL into the project-URL field. The site **auto-detects** the
   homepage, repo URL, license, and several criteria (e.g. `repo_public`,
   `sites_https`, `floss_license`, `contribution`) by inspecting the repo. Let
   it; then reconcile its guesses against your worksheet.
4. Go criterion by criterion. For each, pick **Met / Unmet / N/A / ?**, paste the
   justification text, and paste the evidence URL from the worksheet. The form
   groups them exactly like the worksheet (Basics → Change Control → Reporting →
   Quality → Security → Analysis).
5. Progress saves automatically; the badge shows a **percentage** until 100% of
   the MUST/SHOULD criteria are satisfied, then flips to "passing".

If the user wants you to pre-fill the form via browser automation, you may —
but they must review every answer and click submit themselves. It's their
attestation, not yours. Default to handing them the worksheet to paste.

## Phase 4 — Embed the badge

Once the project entry exists it has a numeric ID (visible in the URL,
`bestpractices.dev/projects/<ID>`). Add the badge to the README:

```markdown
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/__PROJECT_ID__/badge)](https://www.bestpractices.dev/projects/__PROJECT_ID__)
```

Substitute `__PROJECT_ID__`. Drop it near the top of the README alongside any CI
/ license / Scorecard badges. Show the diff; let the user commit.

The badge renders the **current percentage** (e.g. "in progress 84%") until the
project hits 100% passing, then shows "passing". That's expected — the badge is
honest about partial progress, so it's fine to add it before you're at 100%.

## Edge cases

- **Project not FLOSS / no license.** The badge doesn't apply. Offer to add an
  OSI-approved license first; revisit after.
- **No automated tests at all.** `test` is a MUST. You cannot honestly pass
  without at least one. Adding a real (even minimal) test is the fix — don't
  mark it Met without one.
- **Project does no cryptography.** Mark the entire `crypto_*` block N/A with
  "project performs no cryptographic operations." All are `na-allowed`.
- **Already registered.** Search bestpractices.dev for the repo before adding —
  duplicates are messy. If it exists, update the existing entry instead.
- **Monorepo / multiple projects.** The badge is per-project. Pick the unit the
  user means; don't badge the whole org by accident.
- **Private repo.** Audit and prep the worksheet now, but note `repo_public` and
  friends can't truthfully be Met until it's public.
- **User wants silver/gold.** Out of scope here. Note they layer on top of
  passing (more tests, signed releases, two-person review, documented assurance
  case) and point at the silver/gold criteria pages.

## Guidelines

- Never fabricate a "Met". Unknown stays Unknown until the maintainer confirms.
- Don't commit on the user's behalf. Write files, show diffs, let them commit.
- `met-url-required` criteria need a real URL, not just prose — prefer
  permalinks (`gh browse -n <path>` prints a stable URL; or pin to a commit SHA).
- Distinguish real security improvements from paperwork every time you propose
  a change.
- Don't auto-submit the form. The attestation is the user's.
- When a criterion's meaning is unclear, read the official text rather than
  guessing: each criterion's full wording and rationale is at
  [bestpractices.dev/en/criteria/0](https://www.bestpractices.dev/en/criteria/0).

## Note: this vs. OpenSSF Scorecard

| | **Best Practices Badge** (this skill) | **Scorecard** (`security-openssf`) |
|---|---|---|
| What | Self-certification questionnaire | Automated static analysis |
| How | You answer ~67 criteria on a web form | A GitHub Action scores your repo |
| Output | passing/silver/gold badge at bestpractices.dev | 0–10 score + SARIF at scorecard.dev |
| Effort | Mostly documentation + a few real fixes | Install a workflow, triage findings |

They reinforce each other: passing this badge satisfies Scorecard's
`CII-Best-Practices` check, and several Scorecard fixes (SECURITY.md, static
analysis, pinned deps) also satisfy badge criteria. Suggest running both.
