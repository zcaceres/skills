# `/gh-project setup` — Bootstrap the Board

You are bootstrapping a GitHub Projects (v2) kanban board for the current repository and persisting the configuration so the other `/gh-project` subcommands can find it.

## When to use

- "set up a project board" / "create a kanban for this repo"
- "init gh project" / "scaffold github project"
- "/gh-project setup"

If the repo already has a `.github/gh-project.json` (see [Config file](#config-file) below), do NOT silently recreate the project — read it, surface the existing project, and ask whether the user wants to re-link, reconfigure, or abort.

## Required auth scope

GitHub Projects requires the `project` scope on the gh token. Before issuing any project command, check and prompt for it:

```bash
gh auth status 2>&1 | grep -i "scopes" || true
```

If `project` is missing, instruct the user (do not run this for them — it requires their browser):

> Run `gh auth refresh -s project` once, then re-invoke this skill.

## The four gh project IDs (agents get confused — read this)

`gh project` commands work with four distinct identifiers. Mixing them up is the #1 failure mode:

| ID | Looks like | Where it comes from | What it's used for |
|----|------------|--------------------|--------------------|
| **Project number** | small int, e.g. `4` | `gh project create --format json` → `.number` | Positional arg in most `gh project` commands |
| **Project node ID** | `PVT_…` | `gh project view <n> --owner … --format json` → `.id` | `gh project item-edit --project-id` |
| **Field ID** | `PVTF_…` or `PVTSSF_…` | `gh project field-list <n> --owner … --format json` | `gh project item-edit --field-id` |
| **Single-select option ID** | 8-char hex, e.g. `f75ad846` | same field-list call, inside the Status field's `options` | `gh project item-edit --single-select-option-id` |

Other subcommands read these from the config file below — capture them all at setup time.

## Workflow

### 1. Determine owner and repo

```bash
REPO_JSON=$(gh repo view --json owner,name,nameWithOwner)
REPO_OWNER=$(echo "$REPO_JSON" | jq -r '.owner.login')
REPO=$(echo "$REPO_JSON" | jq -r '.name')
PROJECT_OWNER="$REPO_OWNER"   # default; may be overridden below
```

Confirm with the user: "Create a project owned by `$PROJECT_OWNER` for repo `$REPO_OWNER/$REPO`?" If they want a different project owner (e.g. a personal project against an org repo), accept the override and update **only** `PROJECT_OWNER` — `REPO_OWNER` is fixed by `gh repo view` and is what every `gh issue --repo` call needs downstream.

### 2. Pick a title and default mode

Ask:
1. **Project title?** — default to the repo name.
2. **Default card type — `issue` or `draft`?** — default `issue`. Issues are real GitHub issues that show up on the repo's Issues tab and support assignees, labels, milestones, cross-references. Drafts live only on the project board.

### 3. Create the project

```bash
CREATE_JSON=$(gh project create \
  --owner "$PROJECT_OWNER" \
  --title "$TITLE" \
  --format json)

PROJECT_NUMBER=$(echo "$CREATE_JSON" | jq -r '.number')
PROJECT_ID=$(echo "$CREATE_JSON" | jq -r '.id')
PROJECT_URL=$(echo "$CREATE_JSON" | jq -r '.url')
```

### 4. Link to the repo

```bash
gh project link "$PROJECT_NUMBER" --owner "$PROJECT_OWNER" --repo "$REPO_OWNER/$REPO"
```

Linking makes the repo's issues addable via the project picker on the Issues UI and lets `gh issue create --project "$TITLE"` work without `--owner`.

### 5. Capture Status field + option IDs

The default project ships with a `Status` single-select field (`Todo`, `In Progress`, `Done`). Capture the IDs:

```bash
FIELDS_JSON=$(gh project field-list "$PROJECT_NUMBER" --owner "$PROJECT_OWNER" --format json)
STATUS_FIELD_ID=$(echo "$FIELDS_JSON" | jq -r '.fields[] | select(.name=="Status") | .id')
STATUS_TODO_ID=$(echo "$FIELDS_JSON" | jq -r '.fields[] | select(.name=="Status") | .options[] | select(.name=="Todo") | .id')
STATUS_IN_PROGRESS_ID=$(echo "$FIELDS_JSON" | jq -r '.fields[] | select(.name=="Status") | .options[] | select(.name=="In Progress") | .id')
STATUS_DONE_ID=$(echo "$FIELDS_JSON" | jq -r '.fields[] | select(.name=="Status") | .options[] | select(.name=="Done") | .id')
```

If the user wants additional columns (e.g. `Backlog`, `Review`, `Blocked`), GH CLI cannot edit an existing single-select field's options. The cleanest path is:

1. Note the limitation to the user.
2. Offer to open `$PROJECT_URL/settings/fields/<id>` so they can add options manually.
3. After they add them, re-run `field-list` and update the config.

### 6. Write the config file

Write to `.github/gh-project.json` (create `.github/` if missing). This is what every other `/gh-project` subcommand reads — write it carefully.

```json
{
  "projectNumber": 4,
  "projectId": "PVT_kwHOAJkXU84BZADT",
  "projectOwner": "zcaceres",
  "repoOwner": "anthropic",
  "repo": "skills",
  "title": "skills",
  "url": "https://github.com/users/zcaceres/projects/4",
  "defaultMode": "issue",
  "statusField": {
    "id": "PVTSSF_lAHOAJkXU84BZADTzhUB2Sk",
    "options": {
      "Todo": "f75ad846",
      "In Progress": "47fc9ee4",
      "Done": "98236657"
    }
  },
  "version": 2
}
```

Notes:
- Substitute the captured values, not the literal example IDs above.
- `projectOwner` is the GitHub login that owns the **project** (passed to every `gh project --owner` call). `repoOwner` is the GitHub login that owns the **repo** (used in `gh issue --repo "$repoOwner/$repo"`). They are equal in the common case; they diverge when a user runs a personal project against an org repo.
- If the user picked `draft` mode, set `"defaultMode": "draft"`.
- Add any extra status options the user created to `statusField.options`.

### 7. Install the shared board helper script

The other `/gh-project` subcommands delegate board access to a small bash helper so they don't each re-invent (and get wrong) the `gh project item-list` + `jq` recipe. The big wins:

- **Truncation safety** — asserts `fetched == totalCount`; exits non-zero if the limit was hit. Silent truncation is the #1 reason an agent "misses" a card.
- **Compact JSONL output** — projects to `{id, title, status, type, number, url, bodyPreview}`. Each row is ~80 bytes instead of ~300, so the agent can scan 200+ items without context bloat.
- **Single source of truth for IDs** — reads `.github/gh-project.json`; no hard-coded IDs in any subcommand.

Install the script alongside the config:

```bash
mkdir -p .github/scripts

# The canonical script ships with this skill. When this skill is installed
# globally, find it under ~/.claude/skills; for repo-local installs it's
# under node_modules/@zcaceres/skill-gh-project/scripts.
SOURCE=$(command -v claude-skill-find 2>/dev/null \
  && claude-skill-find gh-project scripts/gh-project-board.sh)

# Fallback: search the usual install locations.
if [[ -z "$SOURCE" || ! -f "$SOURCE" ]]; then
  for candidate in \
    "$HOME/.claude/skills/gh-project/scripts/gh-project-board.sh" \
    "./node_modules/@zcaceres/skill-gh-project/scripts/gh-project-board.sh" \
    "./skills/gh-project/scripts/gh-project-board.sh"; do
    [[ -f "$candidate" ]] && SOURCE="$candidate" && break
  done
fi

[[ -f "$SOURCE" ]] || { echo "Could not find gh-project-board.sh; paste it manually into .github/scripts/"; exit 1; }

cp "$SOURCE" .github/scripts/gh-project-board.sh
chmod +x .github/scripts/gh-project-board.sh
```

If the file copy fails (e.g. the skill is loaded from an unusual location), the agent should fall back to writing the script body inline from its own context. The script's source lives in `gh-project/scripts/gh-project-board.sh` in this repo.

After install, smoke-test it:

```bash
.github/scripts/gh-project-board.sh --help
.github/scripts/gh-project-board.sh list | head -3
```

The first call should print usage. The second should emit JSONL rows (or nothing if the board is empty). If it errors with `missing .github/gh-project.json`, step 6 didn't write the config — back up and fix.

**Subcommands** (record in the summary so the user knows what's available):

- `list [--query <q>] [--include-body]` — all items as JSONL, with completeness check
- `find <PVTI_… | issue# | title-substring>` — resolve a selector to matching rows
- `get <item-id>` — full row including body
- `set-status <item-id> <status-name>` — move a card to a status column

Commit `.github/scripts/gh-project-board.sh` alongside `.github/gh-project.json`. Both belong to the user's repo from here on — they're versioned, auditable, and modifiable.

### 8. Update agent docs to point at the config

Agents won't discover `.github/gh-project.json` on their own. Surface it in whatever agent-facing docs this repo already uses, so future invocations of the `/gh-project` subcommands (and other agents like Codex, Cursor) know where to look.

Detect which files exist and consider all of them:

```bash
ls CLAUDE.md AGENTS.md .cursorrules .windsurfrules .clinerules \
   .github/copilot-instructions.md 2>/dev/null
```

For each existing file:

1. **Read it** before editing — never blind-write over a user's curated notes.
2. **Check for an existing project-tracker section** (heading like `## Project tracker`, `## GitHub project`, or a paragraph mentioning the project URL). If present, **replace its body** with the canonical block below while preserving any norms the user wrote underneath (e.g. "move to Done — do not delete").
3. **If absent**, append the canonical block as a new top-level section.

Canonical block (substitute the captured values):

```markdown
## Project tracker

Work for this repo is tracked on the GitHub Project board at $PROJECT_URL.

The project's configuration — number, owner, project node ID, status field ID,
and status option IDs — is stored in `.github/gh-project.json`. Agents managing
this board should read that file rather than hard-coding IDs (IDs change if the
project is recreated).

Board access goes through `.github/scripts/gh-project-board.sh`:

- `list [--query <q>] [--include-body]` — compact JSONL of all items
- `find <PVTI_… | issue# | title-substring>` — resolve a selector
- `get <item-id>` — full row with body
- `set-status <item-id> <status-name>` — move card between columns

The helper asserts completeness against `totalCount` and exits non-zero on
truncation, so an agent that "doesn't see" a card will fail loudly instead
of silently missing it.

Card workflow:
- Create:    `/gh-project new-task` (creates a linked GitHub issue by default)
- Pick:      `/gh-project next` (shows top Todo cards, moves pick to In Progress, dumps context)
- Edit:      `/gh-project update [id|number|title]`
- Decompose: `/gh-project decompose [id|number|title]` (split a big card into linked subtasks)
- Audit:     `/gh-project review` (board vs codebase)
- Delete:    `/gh-project delete [id|number|title]`

When an item is finished, **move it to the `Done` column — do not delete it.**
Deleted draft items lose their history.
```

**Sync rule for this repo:** `CLAUDE.md` and `AGENTS.md` are kept in sync (see the self-reference line at the top of each). When you edit one, mirror the body change to the other in the same commit. Other agent-doc files (`.cursorrules` etc.) are independent.

**Confirm before writing.** Show the user the diff you intend to apply for each file and ask for approval — these files are user-curated. If they reject the edit, skip and continue; setup still succeeds.

### 9. Board view caveat

`gh project` cannot create or edit views — only fields and items. The new project starts with a Table view. To get the kanban look:

> Tell the user: "Open `$PROJECT_URL` → click `New view` → `Board` → group by `Status`. Save it as the default. The gh CLI can't do this for you."

Don't pretend the board view exists if you didn't see the user confirm they made one.

### 10. Offer to allowlist the `gh-project` command surface

Without a permission allowlist, every subcommand (`/gh-project next`, `/gh-project new-task`, etc.) prompts the user to approve each `gh` call. After the first few approvals it's just noise — the same commands fire on every invocation. Offer to write a Claude Code permission allowlist so the subcommands run uninterrupted.

**Ask the user two things:**

1. **Add the allowlist now?** (Default: yes.) If no, skip to step 11.
2. **Which file?**
   - **`.claude/settings.json`** — committed; shared with anyone using Claude Code on this repo. Best when this is the team's tracker.
   - **`.claude/settings.local.json`** — gitignored; just this machine. Best for personal projects.

**Canonical allowlist** (substitute nothing — these are literal patterns):

```json
{
  "permissions": {
    "allow": [
      "Bash(gh auth status:*)",
      "Bash(gh repo view:*)",
      "Bash(gh issue view:*)",
      "Bash(gh issue list:*)",
      "Bash(gh issue create:*)",
      "Bash(gh pr view:*)",
      "Bash(gh pr list:*)",
      "Bash(gh project view:*)",
      "Bash(gh project item-list:*)",
      "Bash(gh project field-list:*)",
      "Bash(gh project item-add:*)",
      "Bash(gh project item-edit:*)",
      "Bash(.github/scripts/gh-project-board.sh:*)"
    ]
  }
}
```

The list covers read-only queries (`view`, `list`), card creation (`issue create`, `item-add`), status moves (`item-edit`), and the board helper script. Destructive operations (`gh issue delete`, `gh project delete`, `gh project item-delete`) are deliberately omitted — those still prompt.

**Merging matters.** If the target file already exists, read it first and merge the new entries into the existing `permissions.allow` array. Don't overwrite other permissions the user already approved. De-dupe — don't add a pattern that's already present.

```bash
TARGET=".claude/settings.json"   # or .claude/settings.local.json based on user pick
mkdir -p .claude
[[ -f "$TARGET" ]] || echo '{}' > "$TARGET"

# Show the user the diff you intend to apply before writing.
```

**Show the diff and wait for explicit confirmation** before writing — same pattern as step 8. If the user declines, skip; setup still succeeds.

### 11. Output

End with a short summary:

```
Created project #<n> "<title>" at <url>
Linked to <owner>/<repo>
Default card mode: issue|draft
Status columns: Todo, In Progress, Done
Config written to .github/gh-project.json
Helper installed: .github/scripts/gh-project-board.sh
Agent docs updated: CLAUDE.md, AGENTS.md  (or "skipped — user declined")
Permissions allowlisted in .claude/settings.json  (or "skipped — user declined")

Next: open <url> and add a Board view grouped by Status.
Subcommands:
  /gh-project new-task   — create a card
  /gh-project next       — pick the next Todo card and start
  /gh-project review     — audit board vs codebase
  /gh-project update     — edit a card
  /gh-project decompose  — split a big card into linked subtasks
  /gh-project delete     — remove a card
```

## Edge cases

- **Project already exists for this repo.** If `.github/gh-project.json` is present, read it and ask before creating a second project. Two projects for one repo is rarely what the user wants.
- **`gh project create` fails with "scope" or 403.** The token is missing `project` scope — fall back to the auth instructions above.
- **Org-owned repo.** `gh repo view --json owner` returns the org login; that's what `--owner` should be. Confirm with the user — they may want a personal project instead.
- **Token has no Issues permission on the repo.** Linking and item-add for issues will fail later. Surface this immediately rather than letting a downstream subcommand blow up.

## Guidelines

- Do not invent IDs. Every ID written into `.github/gh-project.json` must come from a real `gh` command output you ran in this session.
- Do not commit the config file silently. Surface that you wrote it; let the user decide when to commit.
- Keep the workflow conversational at decision points (title, default mode, extra columns) — these are sticky choices the user lives with.
