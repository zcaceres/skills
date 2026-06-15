# security-openssf-bestpractices

Help a FLOSS project earn the [OpenSSF Best Practices Badge](https://www.bestpractices.dev)
(formerly the CII badge) at the **passing** level. The skill:

1. **Audits** the repo against the passing self-certification criteria —
   Met / Unmet / N/A, with an evidence URL for each.
2. **Closes gaps** — adds the common missing pieces (`SECURITY.md`,
   `CONTRIBUTING.md`, build/test docs) from templates.
3. **Generates a worksheet** of justifications + evidence URLs to paste straight
   into the web form.
4. **Walks registration** at bestpractices.dev and **embeds the badge** in the
   README once the project entry exists.

It's **self-attestation**: the badge is the maintainer's public claim, so the
skill never fabricates a "Met" answer and never submits the form for you — it
preps everything and hands you the worksheet.

## Not the same as Scorecard

This is the OpenSSF **Best Practices Badge** (a self-certification
questionnaire), not the OpenSSF **Scorecard** (the automated GitHub Action — see
the sibling skill `security-openssf`). They reinforce each other: earning this
badge satisfies Scorecard's `CII-Best-Practices` check.

## Layout

- `SKILL.md` — the four-phase workflow (audit → close gaps → register → badge)
- `assets/passing-criteria-worksheet.md` — fill-in worksheet of all passing criteria
- `assets/SECURITY.md.template` — closes the vulnerability-reporting criteria
- `assets/CONTRIBUTING.md.template` — closes the contribution criteria

## Install

```
npx skills add zcaceres/skills -s security-openssf-bestpractices
```

Add `-g` for global install, or `-a <agent>` to target a specific agent.
