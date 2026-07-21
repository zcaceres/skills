---
name: optimize-permissions
description: Scan recent conversation transcripts for safe commands that could be auto-allowed by your CLI agent (Claude Code, Codex, Cursor, …), preview the proposed allowlist changes, then write them to the right config. Use when the user says "reduce permission prompts", "auto-allow safe commands", "optimize permissions", or "/optimize-permissions".
---

# optimize-permissions

Reduce permission prompts by learning from commands the user already approved in
recent sessions, across whichever CLI agent they use.

## Mental model

Every CLI agent has an "ask before running" vs "auto-run" setting. The names
differ (Claude Code: `permissions.allow`; Codex: trust policy; Cursor: terminal
auto-run) but the shape is the same: a list of command patterns the agent runs
without stopping.

Read recent transcripts, find commands the user kept approving, generalize each
to the narrowest safe pattern, propose, confirm, write to the config.

## When to run

Trigger phrases: "reduce permission prompts", "auto-allow safe commands", "tame
approvals", "fewer prompts", "what should I always allow", or
`/optimize-permissions`.

If the user has few transcripts, say so and stop. There is nothing to learn
from.

## Step 1 — detect which agents are installed

Probe these markers in order; record every one that exists:

| Agent       | Config root        | Transcript root                                    | Allowlist target                                                          |
|-------------|--------------------|----------------------------------------------------|---------------------------------------------------------------------------|
| Claude Code | `~/.claude/`       | `~/.claude/projects/<url-encoded-cwd>/*.jsonl`     | `.claude/settings.json` (project) or `~/.claude/settings.json` (user)     |
| Codex CLI   | `~/.codex/`        | `~/.codex/sessions/**/*.jsonl`                     | `~/.codex/config.toml` (`[projects]` trust + `[sandbox]`)                 |
| Cursor      | `~/.cursor/`       | not exposed as plain files (skip transcript scan)  | `~/.cursor/settings.json` → `cursor.terminal.autoRun.allowList` (manual)  |
| Aider       | `~/.aider*`        | `.aider.chat.history.md` per project               | n/a — Aider doesn't gate per command                                      |

See `references/agents.md` for current paths, schemas, and write rules.
**Verify paths before writing.** Agents change layouts; don't assume the table
above is still current.

If only one agent is installed, target it. If multiple are installed, ask the
user which to tune (multiSelect is fine).

## Step 2 — find the transcripts to read

Default to the current working directory's transcripts. For Claude Code:

```bash
PROJECT_DIR="${HOME}/.claude/projects/$(pwd | sed 's|/|-|g')"
ls -t "$PROJECT_DIR"/*.jsonl 2>/dev/null | head -20
```

If the user says "across all my projects" or "look at everything", widen to all
projects under the transcript root.

Read up to the most recent **20 session files**, or whatever fits in context.
Older history is less representative of current habits.

## Step 3 — extract Bash invocations

Each agent stores tool calls slightly differently. For Claude Code JSONL
sessions, the relevant lines look like:

```json
{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Bash","input":{"command":"git status"}}]}}
```

For each transcript, pull every Bash (or shell-equivalent) invocation and what
happened next:

- Did the user **approve** it via the permission dialog?
- Did the user **reject** it?
- Was it **already auto-allowed** (no prompt)?

Candidates are commands the user had to approve and always approved. A command
they rejected even once is a strong signal not to propose it.

`scripts/extract-commands.sh` is a grep helper for raw lines; parsing inline is
usually fast enough.

## Step 4 — filter for safety

Be conservative. A false negative (failing to propose something safe) costs one
extra prompt. A false positive (auto-allowing something destructive) can cause
real damage. Prefer false negatives.

### Allowlist these (read-only / observational)

- **File reads**: `ls`, `cat`, `head`, `tail`, `wc`, `file`, `stat`, `tree`,
  `pwd`, `realpath`, `readlink`, `du -sh`, `df`
- **Search**: `grep`, `rg`, `ag`, `find` *without* `-delete` / `-exec`
- **Git inspection**: `git status`, `git log`, `git diff` (no flags that
  write refs), `git show`, `git branch` (no `-D`/`-d`), `git remote -v`,
  `git rev-parse`, `git blame`, `git stash list`, `git config --get`
- **GitHub inspection**: `gh pr view`, `gh pr list`, `gh pr diff`,
  `gh pr status`, `gh issue view`, `gh issue list`, `gh repo view`,
  `gh api` *only* for GET requests (the default)
- **Versions / introspection**: `node --version`, `python --version`,
  `<tool> --help`, `which`, `whoami`, `uname`, `hostname`, `date`
- **Read-only package managers**: `npm ls`, `npm view`, `yarn list`,
  `bun pm ls`, `pip list`, `pip show`, `cargo metadata`, `go list`
- **Read-only containers/k8s**: `docker ps`, `docker images`, `docker logs`,
  `docker inspect`, `kubectl get`, `kubectl describe`, `kubectl logs`

### Never propose these (mutating / dangerous / privileged)

- Filesystem mutations: `rm`, `mv`, `cp`, `mkdir`, `touch`, `chmod`, `chown`,
  `ln`, `dd`, `mkfs`, `shred`, `unlink`, `truncate`
- Privilege escalation: `sudo`, `su`, `doas`
- Process control: `kill`, `killall`, `pkill`
- Network mutations: `curl -X POST/PUT/PATCH/DELETE`, `wget -O`, `scp`, `rsync`
- Git writes: `git push`, `git reset --hard`, `git commit`, `git rebase`,
  `git merge`, `git checkout` (touches files), `git clean`, `git tag`,
  `git stash drop`
- GitHub writes: `gh pr merge`, `gh pr close`, `gh pr edit`, `gh issue close`,
  `gh release create`
- Package installs / upgrades: `npm install`, `npm uninstall`, `yarn add`,
  `pip install`, `brew install/upgrade/uninstall`, `apt`, `cargo install`
- Shell redirections that write: any `>`, `>>`, `| tee`, heredocs that target
  files, `cat <<EOF > …`
- Compound commands containing **any** disallowed call — split on `&&`, `||`,
  `;`, `|`, command substitution `$(…)` / backticks

### Flag for review (don't auto-propose; ask explicitly)

- `env`, `printenv` with no args — risks dumping secrets
- `cat .env*` — same
- `gh auth status` — usually fine but leaks identity
- `history`, `cat ~/.zsh_history` — leaks past commands
- Anything reading absolute paths outside the current project
  (e.g. `cat /etc/...`)

When in doubt, don't propose it.

## Step 5 — generalize to the narrowest pattern

**Propose the minimally permissive pattern that covers what the user ran.** Keep
the command literal up to the point where an argument genuinely varies; put the
wildcard only there. Never widen a pattern past the behavior the transcripts
show.

### Default: keep the command specific

If the user ran `uv run test_suite.py`, propose `Bash(uv run test_suite.py)` (or
`Bash(uv run test_suite.py:*)` to also allow trailing flags on that same
script). Do **not** propose `Bash(uv run:*)` — that allows `uv run` with any
script, far beyond the observed behavior.

| Observed                      | Propose                        | Not              |
|-------------------------------|--------------------------------|------------------|
| `git status`, `git status -s` | `Bash(git status:*)`           | `Bash(git:*)`    |
| `npm ls`                      | `Bash(npm ls)`                 | `Bash(npm:*)`    |
| `uv run test_suite.py`        | `Bash(uv run test_suite.py:*)` | `Bash(uv run:*)` |

### Exception: wildcard where the argument is inherently variable

When the variable part directly follows a fixed command, can't be enumerated,
and the command is safe for any value, the wildcard is the point:

- `gh pr view 123`, `gh pr view 124`, … → `Bash(gh pr view:*)` (any PR number)
- `gh issue view 5` → `Bash(gh issue view:*)`
- `git show <sha>` → `Bash(git show:*)`

Test: is enumerating every value impractical, and is the command safe across all
of them? If yes, wildcard. If the argument is a fixed script or subcommand, keep
it literal.

### Pattern syntax per agent

| Agent       | Syntax                                                     |
|-------------|-----------------------------------------------------------|
| Claude Code | `Bash(<cmd>)` exact; `Bash(<cmd>:*)` allows trailing args  |
| Codex       | TOML trust scopes; matching is coarser, project-level     |
| Cursor      | shell glob (`gh pr view *`) in the JSON list              |

### Never over-broaden

- `Bash(*)` is never a valid proposal.
- `Bash(git:*)` includes `git push` and `git reset`.
- `Bash(uv run:*)` allows arbitrary scripts.
- `Bash(cat:*)` matches `cat .env`, `cat ~/.ssh/id_rsa`. For `cat` and similar,
  scope to a safe path (`Bash(cat README*)`) or drop the candidate. See
  `references/safe-commands.md` Tier 2.

## Step 6 — preview and confirm

Render a preview before writing. Group by tier (Allow / Flag for review), show
the pattern and a "seen N times across M sessions" count:

```
Proposed additions to ~/.claude/settings.json (user scope)

Allow (read-only, seen frequently):
  + Bash(git status:*)        — 47× over 12 sessions
  + Bash(gh pr view:*)        — 23× over 8 sessions
  + Bash(rg:*)                — 19× over 6 sessions
  + Bash(ls:*)                — 18× over 11 sessions

Flag for review (you'll be asked each time):
  ? Bash(env:*)               — could leak env vars; auto-allow anyway?
```

Use **AskUserQuestion** with multiSelect for the final cut. Default the safe
tier checked and the "flag for review" tier unchecked. Offer an "edit list
manually" option.

Confirm scope: **user-level** (all projects, fewer prompts everywhere) vs
**project-level** (this repo only, safer for project-specific patterns like a
custom CLI).

## Step 7 — write the config

Read the existing config, **merge** rather than overwrite, dedupe against
existing entries, write atomically (temp file then rename). Back up first with a
timestamp:

```bash
cp ~/.claude/settings.json ~/.claude/settings.json.bak.$(date +%s)
```

For Claude Code `settings.json`:

```jsonc
{
  "permissions": {
    "allow": [
      "Bash(git status:*)",
      "Bash(gh pr view:*)"
    ]
  }
}
```

If `permissions` or `permissions.allow` is missing, create it. Preserve every
other key untouched. 2-space indent, trailing newline.

For agents whose allowlist isn't a flat array (Codex's TOML, Cursor's
namespaced JSON), follow `references/agents.md` for the exact write shape.

## Step 8 — report

Print the final diff (added entries, target file, backup path). Tell the user
they can revert by restoring the backup. Keep it terse; don't re-summarize the
preview.

## Safety rails

- **Never** write to a config the user didn't confirm.
- **Never** propose `sudo`, `rm`, `git push`, package installs, or anything
  with a `>` redirect.
- **Never** broaden a pattern past what the data supports. If the user only
  ran `git status` and `git status -s`, propose `Bash(git status:*)`, not
  `Bash(git:*)`.
- **Always** back up before writing.
- If transcripts are sparse (< 3 sessions) or the candidate list is empty,
  say so and stop.

## See also

- `references/agents.md` — per-agent config paths, schemas, write rules
- `references/safe-commands.md` — the full safe/unsafe taxonomy used in Step 4
