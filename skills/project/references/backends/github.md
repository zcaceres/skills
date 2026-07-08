# GitHub Projects backend adapter

How each adapter verb the workflow bodies call maps to a concrete command on the
GitHub Projects backend. The guard ([../\_guard.md](../_guard.md)) exports
`$HELPER` (`.project/scripts/board.sh`), `$REPO_OWNER`, `$REPO`,
`$PROJECT_OWNER`, `$PROJECT_NUMBER`, and `$CFG` (the config path).

Board reads go through `$HELPER`, never raw `gh project item-list` — it asserts
`fetched == totalCount` and exits non-zero on truncation, so a partial board
fails loudly instead of silently.

## Universal verbs

| Verb | GitHub implementation |
|---|---|
| `list_items(query?)` | `$HELPER list [--query "<q>"] [--include-body]` → compact JSONL (`id,title,status,type,number,url,bodyPreview`). Server-side filters like `--query "status:Todo"` / `"-status:Done"`. |
| `find_item(selector)` | `$HELPER find <PVTI_… \| issue# \| title-substring>` → zero or more rows. |
| `get_item(id)` | `$HELPER get <PVTI_…>` → one row with full body. |
| `create_item(type,title,body,fields?)` | **issue:** `gh issue create --repo "$REPO_OWNER/$REPO" --title … --body … --project "<title>" [--milestone] [--label] [--assignee]`. **draft:** `gh project item-create "$PROJECT_NUMBER" --owner "$PROJECT_OWNER" --title … --body … --format json` → `.id`. |
| `update_item_title(id,t)` | **issue:** `gh issue edit <n> --repo "$REPO_OWNER/$REPO" --title …`. **draft:** `gh project item-edit --id <PVTI_…> --title …`. |
| `update_item_body(id,b)` | **issue:** `gh issue edit <n> --repo … --body-file <f>`. **draft:** `gh project item-edit --id <PVTI_…> --body …`. |
| `set_item_status(id,canonical)` | Translate canonical → native name (see below), then `$HELPER set-status <PVTI_…> "<native name>"`. |
| `link_parent_child(parent,child)` | Sub-issues REST: `gh api repos/$REPO_OWNER/$REPO/issues/<child> --jq .id` → `gh api --method POST repos/$REPO_OWNER/$REPO/issues/<parent>/sub_issues -F sub_issue_id=<db-id>`. 404 = feature not enabled, 422 = already linked. Fallback: append a `- [ ] #<child>` checklist to the parent body via `update_item_body`. Drafts can't be sub-issues (checklist only). |
| `close_item(id,comment?)` | `gh issue close <n> --repo "$REPO_OWNER/$REPO" [--comment …]`. Draft-only cards have no issue to close. |
| `unlink_item(id)` | `gh project item-delete "$PROJECT_NUMBER" --owner "$PROJECT_OWNER" --id <PVTI_…>` — removes the card from the board; the underlying issue persists unless separately closed/deleted. |

## GitHub-only verbs (used by `setup`; no Linear equivalent)

| Verb | GitHub implementation |
|---|---|
| `verify_project_scope_on_token()` | `gh auth status` must list the `project` scope; else route the user to `gh auth refresh -s project`. |
| `create_project(owner,title,mode?)` | `gh project create --owner … --title … --format json` → `.number`, `.id`. |
| `link_project_to_repo(...)` | `gh project link <number> --owner … --repo …`. |
| `list_status_field_options(...)` | `gh project field-list <number> --owner … --format json` → the Status field id (`PVTSSF_…`) and its option-name → 8-char-hex-id map. |
| `create_draft_card(...)` | the draft branch of `create_item` above. |

## Status translation

Workflow bodies name a canonical status (`backlog`/`todo`/`in_progress`/`done`/
`cancelled`). The github adapter resolves it in two hops:

1. **canonical → native option name** via `$CFG`'s `statusMap`, e.g.
   `jq -r '.statusMap.in_progress' "$CFG"` → `"In Progress"`.
2. **native name → option id** inside `$HELPER set-status`, which reads
   `statusField.options["In Progress"]` from the config.

Default GitHub Projects boards ship only Todo / In Progress / Done, so `statusMap`
maps `backlog` and `cancelled` to `null`. When a body asks for a `null`-mapped
status:

- `backlog` → fall back to `todo`.
- `cancelled` → leave the card's status unchanged and note the cancellation in the
  body; optionally `close_item`.

`setup` records the `statusMap` and surfaces any canonical status it couldn't map
so the user can add the column on github.com if they want it.
