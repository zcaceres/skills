# Linear backend adapter

How each adapter verb the workflow bodies call maps to a concrete call on the
Linear backend. The backend is the **official Linear MCP** (model-invoked tools),
so this doc *is* the adapter. There is no board script. The guard
([../\_guard.md](../_guard.md)) confirms the MCP is reachable and reads
`.project/config.json` for `teamId`, `teamKey`, `projectId`, `statusMap`
(canonical → workflow-state UUID), and `statusNames`.

## Completeness rule (read before any list verb)

`board.sh`'s fail-loud `fetched == totalCount` guarantee has no equivalent in a
model-invoked tool, so enforce it by hand:

> Call `list_issues` with the team filter. If the response carries a pagination
> cursor or otherwise signals more results, fetch the next page and repeat until
> exhausted. If you cannot exhaust it, **stop and tell the user the list is
> truncated**. Never rank, audit, or "pick next" from a partial board.

## Universal verbs

| Verb | Linear implementation |
|---|---|
| `list_items(query?)` | `list_issues(teamId, …filters)` under the Completeness rule. Filter by state, assignee, cycle, label as the subcommand needs. Return the same shape the bodies expect (`id`, `title`, `status`, `url`, identifier as `number`, body/preview). |
| `find_item(selector)` | `SKL-123` identifier or a UUID → `get_issue`. Title substring → `list_issues` then match locally. |
| `get_item(id)` | `get_issue(id)` → title, description, state, parent, children, comments. |
| `create_item(type,title,body,fields?,parentId?)` | `create_issue(teamId, title, description, stateId, priority?, estimate?, cycleId?, projectId?, parentId?)`. `type` is ignored — every Linear item is a first-class issue (no drafts). `stateId` = `statusMap[canonical]`. |
| `update_item_title(id,t)` | `update_issue(id, title)`. |
| `update_item_body(id,b)` | `update_issue(id, description)`. |
| `set_item_status(id,canonical)` | `update_issue(id, stateId = statusMap[canonical])`. |
| `link_parent_child(parent,child)` | Native sub-issues: create the child with `create_issue(..., parentId = <parent UUID>)`. One call, no REST, no body checklist. This skill only ever creates fresh children under a parent (`decompose`), so parenting is always set at create time — there is no re-parent step. |
| `close_item(id,comment?)` | `update_issue(id, stateId = statusMap.done)`; optional `create_comment(id, comment)`. |
| `unlink_item(id)` | Linear has no board-scoped unlink. Treat "remove from board" as **cancel/archive**: `update_issue(id, stateId = statusMap.cancelled)`. Hard delete is out of scope for the MCP. |

Comments (used by `update` / `review` to add context): `create_comment(issueId, body)`,
`list_comments(issueId)`.

## Status translation

Bodies name a canonical status (`backlog`/`todo`/`in_progress`/`done`/`cancelled`).
The Linear adapter resolves it in one hop: `statusMap[canonical]` is the workflow-
state **UUID** passed as `stateId`. Linear teams normally define all five as
first-class workflow states, so unlike github none map to `null`. `statusNames`
holds the human labels for display.

## GitHub-only verbs — n/a on Linear

| Verb | Why n/a |
|---|---|
| `verify_project_scope_on_token` | Auth is the MCP connection, not a `gh` token scope. |
| `create_project` | No board to create; `setup` picks an existing team (and optional Linear project). |
| `link_project_to_repo` | Linear issues aren't repo-scoped; no linking step. |
| `list_status_field_options` | Replaced by `list_issue_statuses(teamId)` → the `statusMap`. |
| `create_draft_card` | No drafts. `create_item` always makes a real issue. |

## Per-subcommand divergences

The workflow bodies are backend-neutral; these are the only spots where the Linear
path differs from github, keyed to the inline split in each subcommand reference.

- **new-task** — no draft type. Ignore `--draft` / `defaultMode`, with a one-line
  note to the user. Optional fields are `priority`, `estimate`, `cycleId`,
  `projectId` (not milestone/labels/assignees).
- **next** — ranking signals are **cycle** (current/next cycle first), **priority**
  (Urgent→Low), and **estimate**, then age. There are no milestones or GitHub-style
  phase labels. Keep the body's contextual-ranking judgment; swap only the signals.
- **decompose** — children are native sub-issues. Pass `parentId` at create time;
  skip the sub-issues REST call and the parent body checklist entirely.
- **review** — gather evidence the same way, but there is no `board.sh`; list via
  `list_issues` under the Completeness rule. "Linked PR" evidence comes from the
  issue's GitHub attachments/links if the workspace integrates GitHub, else rely on
  branch-name/identifier matches in git history.
- **update** — title/body/status via `update_issue`. "Custom fields" map to Linear
  natives (priority/estimate/cycle/project), not GitHub project single-selects.
- **delete** — "delete" means cancel/archive (`unlink_item`), not removal. Spell
  this out: the issue moves to the Cancelled state and stays in the workspace.
