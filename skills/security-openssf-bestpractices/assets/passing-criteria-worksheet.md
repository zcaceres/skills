# OpenSSF Best Practices — Passing Worksheet

Fill one row per criterion, then paste each row's **Answer / Justification /
Evidence URL** into the matching field on bestpractices.dev.

- **Answer**: `Met` / `Unmet` / `N/A` / `?` (Unknown — confirm with maintainer)
- `N/A` is only valid where the **na** column says `na`.
- `url` in the **req** column means the form *requires* an evidence URL for a Met
  answer — prose alone won't satisfy it. Prefer a permalink to the file/page.
- **Never** mark `Met` without real evidence. Default to `?`.

Levels: **MUST** (required to pass) · **SHOULD** (met-or-justify to pass) ·
**SUGGESTED** (may stay unmet).

Project: `__OWNER/REPO__`  ·  URL: `__REPO_URL__`  ·  Date: `__DATE__`

---

## Basics

| Criterion | Level | req | na | Answer | Justification + evidence URL |
|---|---|---|---|---|---|
| `description_good` — clear, unambiguous project description | MUST | | | | |
| `interact` — how to get help / interact is documented | MUST | | | | |
| `contribution` — how to contribute is documented | MUST | url | | | |
| `contribution_requirements` — contribution requirements documented | SHOULD | url | | | |
| `floss_license` — released under a FLOSS license | MUST | | | | |
| `floss_license_osi` — license is OSI-approved | SUGGESTED | | | | |
| `license_location` — license is in a standard location | MUST | url | | | |
| `documentation_basics` — basic docs for the software exist | MUST | | na | | |
| `documentation_interface` — reference docs for the interface | MUST | | na | | |
| `sites_https` — project sites support HTTPS | MUST | | | | |
| `discussion` — a discussion mechanism exists | MUST | | | | |
| `english` — can interact in English | SHOULD | | | | |
| `maintained` — project is actively maintained | MUST | | | | |

## Change Control

| Criterion | Level | req | na | Answer | Justification + evidence URL |
|---|---|---|---|---|---|
| `repo_public` — public version-controlled source repo | MUST | | | | |
| `repo_track` — tracks what changes were made & when | MUST | | | | |
| `repo_interim` — interim versions available between releases | MUST | | | | |
| `repo_distributed` — uses a distributed VCS (e.g. git) | SUGGESTED | | | | |
| `version_unique` — each release has a unique version id | MUST | | | | |
| `version_semver` — uses SemVer (or documented format) | SUGGESTED | | | | |
| `version_tags` — releases are tagged in the repo | SUGGESTED | | | | |
| `release_notes` — human-readable release notes per release | MUST | url | na | | |
| `release_notes_vulns` — release notes flag fixed public vulns | MUST | | na | | |

## Reporting

| Criterion | Level | req | na | Answer | Justification + evidence URL |
|---|---|---|---|---|---|
| `report_process` — documented process to submit bug reports | MUST | url | | | |
| `report_tracker` — uses an issue tracker for bugs | SHOULD | | | | |
| `report_responses` — maintainers respond to bug reports | MUST | | | | |
| `enhancement_responses` — maintainers respond to enhancement requests | SHOULD | | | | |
| `report_archive` — bug report archive is publicly readable | MUST | url | | | |
| `vulnerability_report_process` — documented vuln-reporting process | MUST | url | | | |
| `vulnerability_report_private` — supports private vuln reports | MUST | url | na | | |
| `vulnerability_report_response` — responds to vuln reports in time | MUST | | na | | |

## Quality

| Criterion | Level | req | na | Answer | Justification + evidence URL |
|---|---|---|---|---|---|
| `build` — a working build system (if build needed) | MUST | | na | | |
| `build_common_tools` — build uses common tools | SUGGESTED | | na | | |
| `build_floss_tools` — can be built with only FLOSS tools | SHOULD | | na | | |
| `test` — at least one automated test suite, released as FLOSS | MUST | | | | |
| `test_invocation` — documented how to run the tests | SHOULD | | | | |
| `test_most` — tests cover most of the code/functionality | SUGGESTED | | | | |
| `test_continuous_integration` — tests run on each change (CI) | SUGGESTED | | | | |
| `test_policy` — policy that new functionality gets tests | MUST | | | | |
| `tests_are_added` — evidence new tests are added with changes | MUST | | | | |
| `tests_documented_added` — the test-adding policy is documented | SUGGESTED | | | | |
| `warnings` — compiler/linter warnings enabled | MUST | | na | | |
| `warnings_fixed` — warnings are addressed | MUST | | na | | |
| `warnings_strict` — maximally strict warnings used | SUGGESTED | | na | | |

## Security

| Criterion | Level | req | na | Answer | Justification + evidence URL |
|---|---|---|---|---|---|
| `know_secure_design` — devs know how to design securely | MUST | | | | |
| `know_common_errors` — devs know common implementation vulns | MUST | | | | |
| `crypto_published` — uses only published crypto protocols | MUST | | na | | |
| `crypto_call` — calls existing crypto, doesn't reimplement | SHOULD | | na | | |
| `crypto_floss` — crypto software is FLOSS | MUST | | na | | |
| `crypto_keylength` — uses adequate key lengths | MUST | | na | | |
| `crypto_working` — no broken/known-weak crypto algorithms | MUST | | na | | |
| `crypto_weaknesses` — avoids algorithms with serious weaknesses | SHOULD | | na | | |
| `crypto_pfs` — supports perfect forward secrecy | SHOULD | | na | | |
| `crypto_password_storage` — stores passwords with salted hashes | MUST | | na | | |
| `crypto_random` — uses cryptographically secure RNG | MUST | | na | | |
| `delivery_mitm` — delivery protected against MITM | MUST | | | | |
| `delivery_unsigned` — no unsigned download over HTTP only | MUST | | | | |
| `vulnerabilities_fixed_60_days` — public vulns fixed ≤60 days | MUST | | | | |
| `vulnerabilities_critical_fixed` — critical vulns fixed promptly | SHOULD | | | | |
| `no_leaked_credentials` — no leaked valid credentials in repo | MUST | | | | |

## Analysis

| Criterion | Level | req | na | Answer | Justification + evidence URL |
|---|---|---|---|---|---|
| `static_analysis` — at least one static-analysis tool used | MUST | just | na | | |
| `static_analysis_common_vulnerabilities` — tool checks common vulns | SUGGESTED | | na | | |
| `static_analysis_fixed` — issues found by SAST are fixed | MUST | | na | | |
| `static_analysis_often` — SAST runs on most/every change | SUGGESTED | | na | | |
| `dynamic_analysis` — a dynamic-analysis tool is used | SUGGESTED | | | | |
| `dynamic_analysis_unsafe` — dynamic analysis for memory safety | SUGGESTED | | na | | |
| `dynamic_analysis_enable_assertions` — assertions on during testing | SUGGESTED | | | | |
| `dynamic_analysis_fixed` — issues found by dynamic analysis fixed | MUST | | na | | |

---

## Summary (fill after auditing)

- MUST met: `__ / 39__`
- MUST unmet (blocking passing): `____`
- SHOULD met-or-justified: `____`
- N/A (with reason): `____`
- Unknown — needs maintainer confirmation: `____`

**Blocking passing:** list every Unmet MUST here. The badge flips to "passing"
only when all MUST are met and all SHOULD are met-or-justified.

> `req` legend: `url` = evidence URL required for Met · `just` = written
> justification required for Met. `na` legend: `na` = "Not Applicable" is an
> accepted answer for this criterion.
