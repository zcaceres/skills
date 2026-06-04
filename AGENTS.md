# AGENTS.md

> **Sync with `CLAUDE.md`.** This file's body is kept in sync with `CLAUDE.md`
> so other agents (Codex, Cursor, etc.) get the same context. Only the title
> and this self-reference line differ between the two; when you edit one,
> mirror the change to the other in the same commit.

## Project tracker

Work for this repo is tracked on the **skills** GitHub Project board:
https://github.com/users/zcaceres/projects/4

When an item is finished, **move it to the `Done` column — do not delete it.**
Deleted draft issues lose their history; `Done` keeps the trail of what shipped
and why.

```bash
# Mark a project item as Done
gh project item-edit \
  --project-id PVT_kwHOAJkXU84BZADT \
  --field-id  PVTSSF_lAHOAJkXU84BZADTzhUB2Sk \
  --id        <PVTI_… item id> \
  --single-select-option-id 98236657   # "Done"
```
