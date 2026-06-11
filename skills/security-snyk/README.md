# security-snyk

Set up [Snyk](https://app.snyk.io) on the current repo. Snyk's integration
is two things — a GitHub App **and** a Snyk-side "import this repo as a
project" step. Most users do the App and skip the project import, then
wonder why nothing is happening. The skill walks both, then verifies the
App side via the GitHub API.

1. **Web install walkthrough.** Snyk login → Integrations → GitHub Connect
   → GitHub App install screen → back to Snyk → Projects → Add projects.
   The Add-projects step is the one everyone misses; the skill calls it out
   up front.
2. **API verification.** Confirm the `snyk-io` App is installed on the
   account that owns this repo and the current repo is in the selected-repos
   list. (The "is this repo imported as a Snyk project" side needs a Snyk
   API token; the skill asks the user to confirm manually instead.)
3. **Noise tuning by default.** Walks the user through toggling
   "Automatic fix PRs" off so the import doesn't dump a wave of unsolicited
   PRs into the repo. Keeps "PR Checks" on. Opt-out is explicit if the user
   actively wants the fix PRs.
4. **Optional CI workflow for SAST.** `snyk code test` on PRs. The App's
   free tier covers dependency CVEs but not SAST — this fills the gap.
   Costs one Snyk Code test per run against the ~100-200/mo free quota.

User-triggered only — activates when the user invokes `/security-snyk`.

## Layout

- `SKILL.md` — workflow + per-finding triage cheat-sheet (high-sev CVE
  with/without fix, transitive CVEs, SAST findings, license, container/IaC)
- `assets/snyk.yml` — optional CI workflow template, npm-pinned snyk CLI,
  runs `snyk code test --severity-threshold=high`

## Install

```
npx skills add zcaceres/skills -s security-snyk
```

Add `-g` for global install, or `-a <agent>` to target a specific agent.
