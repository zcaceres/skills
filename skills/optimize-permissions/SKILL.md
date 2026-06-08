---
name: optimize-permissions
description: Scan recent conversation transcripts for safe commands that could be auto-allowed by your CLI agent (Claude Code, Codex, Cursor, …), preview the proposed allowlist changes, then write them to the right config. Use when the user says "reduce permission prompts", "auto-allow safe commands", "optimize permissions", or "/optimize-permissions".
---

# optimize-permissions

Cut down on permission prompts by learning from what the user *already* approved
in recent sessions — across whichever CLI agent they actually use. Inspired by
Anthropic's bundled `fewer-permission-prompts` skill, but agent-agnostic.

## Mental model

Every CLI agent has some flavor of "ask before running" vs "auto-run". The names
differ — Claude Code calls it `permissions.allow`, Codex calls it the trust
policy, Cursor calls it terminal auto-run — but the shape is the same: a list
of command patterns the agent will execute without stopping.

Read the user's recent transcripts → pick out commands they kept approving →
generalize to a pattern → propose → confirm → write to the right config.

## When to run

Trigger phrases: *reduce permission prompts*, *auto-allow safe commands*, *tame
approvals*, *fewer prompts*, *what should I always allow*, or
`/optimize-permissions`.

If the user hasn't accumulated many transcripts yet, say so and stop — there's
nothing to learn from.

## Step 1 — detect which agents are installed

Probe these markers in order; record every one that exists:

| Agent       | Config root        | Transcript root                                    | Allowlist target                                                          |
|-------------|--------------------|----------------------------------------------------|---------------------------------------------------------------------------|
| Claude Code | `~/.claude/`       | `~/.claude/projects/<url-encoded-cwd>/*.jsonl`     | `.claude/settings.json` (project) or `~/.claude/settings.json` (user)     |
| Codex CLI   | `~/.codex/`        | `~/.codex/sessions/**/*.jsonl`                     | `~/.codex/config.toml` (`[projects]` trust + `[sandbox]`)                 |
| Cursor      | `~/.cursor/`       | not exposed as plain files (skip transcript scan)  | `~/.cursor/settings.json` → `cursor.terminal.autoRun.allowList` (manual)  |
| Aider       | `~/.aider*`        | `.aider.chat.history.md` per project               | n/a — Aider doesn't gate per command                                      |

See `references/agents.md` for current paths, schemas, and write rules.
**Verify paths before writing** — agents change layouts; don't assume the
table above is still current.

If only one agent is installed, target it silently. If multiple are installed,
ask the user which to tune (multiSelect is fine).

## Step 2 — find the transcripts to read

Default to the current working directory's transcripts. For Claude Code that's:

```bash
PROJECT_DIR="${HOME}/.claude/projects/$(pwd | sed 's|/|-|g')"
ls -t "$PROJECT_DIR"/*.jsonl 2>/dev/null | head -20
```

If the user says "across all my projects" or "look at everything", widen to all
projects under the transcript root.

Read up to the most recent **20 session files** (or whatever fits comfortably
in context — these can be large). Older history is less representative of
current habits.

## Step 3 — extract Bash invocations

Each agent stores tool calls slightly differently. For Claude Code JSONL
sessions, the relevant lines look like:

```json
{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Bash","input":{"command":"git status"}}]}}
```

For each transcript, pull every Bash (or shell-equivalent) invocation along
with what happened next:

- Did the user **approve** it via the permission dialog?
- Did the user **reject** it?
- Was it **already auto-allowed** (no prompt at all)?

You want commands the user *had* to approve but always approved. Those are the
candidates. A command they rejected even once is a strong signal *not* to
propose it.

`scripts/extract-commands.sh` is a thin grep helper if you want raw lines;
parsing into structured data inline is usually fast enough.

## Step 4 — filter for safety

This is the load-bearing step. Be conservative: **a false negative (failing to
propose something safe) costs the user one more prompt; a false positive
(auto-allowing something destructive) costs them their afternoon.**

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

When in doubt, **don't propose it**. Better to ask one more time than to ship
a silent shotgun.

## Step 5 — generalize to patterns

Don't propose 50 identical `gh pr view 123`, `gh pr view 124` entries. Collapse
to the agent's native wildcard:

| Agent       | Pattern syntax                                              |
|-------------|-------------------------------------------------------------|
| Claude Code | `Bash(gh pr view:*)` — the trailing `:*` matches any args   |
| Codex       | TOML trust scopes; pattern matching is coarser, project-level |
| Cursor      | shell glob (`gh pr view *`) in the JSON list                |

For Claude Code specifically, group by the leading token(s) of the command:
- `git status` → `Bash(git status:*)` (covers `git status`, `git status -s`)
- `npm ls` → `Bash(npm ls:*)`

Some commands can't be generalized by leading token. `cat` is the canonical
example — `Bash(cat:*)` would match `cat .env`, `cat ~/.ssh/id_rsa`, etc., all
of which `references/safe-commands.md` Tier 2 says to flag, not auto-allow.
For these, either propose narrower patterns tied to specific safe paths
(`Bash(cat README*)`) or drop the candidate entirely.

Don't over-broaden. `Bash(*)` is never a valid proposal. `Bash(git:*)` is too
broad because it includes `git push` and `git reset`.

## Step 6 — preview and confirm

Render a clean preview before writing. Group by tier (Allow / Flag for review),
show the pattern and a one-line "seen N times across M sessions" hint:

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
tier checked; default the "flag for review" tier unchecked. Always offer an
"edit list manually" escape hatch.

Confirm scope: **user-level** (applies to all projects, fewer prompts
everywhere) vs **project-level** (only this repo, safer if patterns are
project-specific like a custom CLI).

## Step 7 — write the config

Read the existing config, **merge** rather than overwrite, dedupe against
existing entries, write atomically (temp file then rename). Back up first
with a timestamp:

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
they can revert by restoring the backup. Don't re-summarize what they already
saw in the preview — keep it terse.

## Safety rails

- **Never** write to a config the user didn't confirm.
- **Never** propose `sudo`, `rm`, `git push`, package installs, or anything
  with a `>` redirect.
- **Never** broaden a pattern past what the data supports. If the user only
  ran `git status` and `git status -s`, propose `Bash(git status:*)`, not
  `Bash(git:*)`.
- **Always** back up before writing.
- If transcripts are sparse (< 3 sessions) or the candidate list is empty,
  say so and stop. Don't manufacture proposals.

## See also

- `references/agents.md` — per-agent config paths, schemas, write rules
- `references/safe-commands.md` — the full safe/unsafe taxonomy used in Step 4
- Anthropic's bundled `fewer-permission-prompts` skill (Claude Code only) —
  the inspiration; this one targets whichever agent the user actually has open.
