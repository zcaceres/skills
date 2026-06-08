---
name: safety-dotenv-guard
description: Blocks Read, Bash, Grep, and Glob tool calls that touch .env files in Claude Code so secrets never enter the agent's context. Allows .env.example / .env.sample / .env.template / .env.dist. PreToolUse hook. Frontmatter block fires only when this skill is active in context; run `scripts/install.sh` after `npx skills add` for always-on protection.
hooks:
  PreToolUse:
    - matcher: "Read|Bash|Grep|Glob"
      type: command
      command: "~/.claude/skills/safety-dotenv-guard/scripts/run.sh"
---

# safety-dotenv-guard

A PreToolUse hook that intercepts `Read`, `Bash`, `Grep`, and `Glob` tool
calls, scans the payload for `.env` filenames, and blocks the call (exit
code 2) when one is found. `.env` files routinely hold production secrets
(DB URLs, API keys, signing keys); once the agent reads them they live in
its context and can leak into transcripts, summaries, or PR diffs.

Common template files (`.env.example`, `.env.sample`, `.env.template`,
`.env.dist`) are explicitly allowed because they are designed to be checked
into source control.

This is a **defense layer, not a guarantee.** A determined adversary or a
cleverly obfuscated path can bypass any pattern check. Run it alongside
proper secret management, .gitignore hygiene, and sandboxing — not in place
of them.

## What it blocks

**Read tool:** any `file_path` whose basename matches a blocked `.env` name,
including Windows-style paths (`C:\repo\.env`) and nested suffixes
(`.env.local.backup`).

**Bash tool:** any command that references a blocked `.env` file, including:

- Direct reads: `cat .env`, `head .env.local`, `less .env.production`,
  `awk 1 .env`, `sed -n 1p .env`, `xxd .env`, `strings .env`,
  `od -c .env`, `hexdump .env`, `wc -l .env`, `file .env`
- Sourcing: `source .env`, `. .env`
- Copying / exfil: `cp .env /tmp/x`, `tar czf out.tgz .env`,
  `curl -F file=@.env …`
- Operators: `ls && cat .env`, `cat .env | base64`
- Tilde / variable / command-substitution paths: `cat ~/.env`,
  `cat $HOME/.env`, `cat ${HOME}/.env`, `$(cat .env)`, `` `cat .env` ``
- Writes (blocked as a side effect — text scan can't distinguish read
  from write): `echo X >> .env`, `echo X > .env.local`
- **Subshell bypass attempts:** `sh -c 'cat .env'`, `bash -c "cat .env"`,
  `zsh -c 'cat .env.local'`, `eval 'cat .env'`. Checked against the
  original command before quote stripping.
- **find with -name:** `find . -name '.env'`, `find . -name '.env*'`,
  `find . -iname '.env'` — including quoted-arg variants.
- **Wildcard expansions** that could glob to `.env`: `cat .e*`,
  `cat .env*`, `cat .env.?*`, `cat .???`, `cat .e?v`.

Quoted strings without a subshell/eval/find context are stripped first so
`echo "rm .env"`, `git commit -m "added .env support"`, and
`grep -E 'rm|del'` are unaffected.

**Grep tool:** `path` or `glob` arguments that resolve to a blocked `.env`
name (e.g. `path: ".env"`, `glob: "**/.env.local"`).

**Glob tool:** `pattern` or `path` arguments that target a blocked `.env`
name, including wildcards (`pattern: "**/.env"`, `"**/.env*"`, `".e*"`,
`".???"`).

**Blocked names:** `.env`, `.env.local`, `.env.production`,
`.env.development`, `.env.staging`, `.env.test`, and any other
`.env.<suffix>` (including multi-suffix variants like `.env.local.backup`)
not on the allowlist below.

## What it allows

- Template files: `.env.example`, `.env.sample`, `.env.template`, `.env.dist`
- `.envrc` (direnv config, not a dotenv file)
- Unrelated paths that happen to contain `env` (e.g. `src/env.ts`,
  `.env-helpers/`, `environment.yml`, `npm install dotenv`)
- `.env` references inside quoted strings on the Bash tool — unless the
  enclosing command is a subshell (`sh -c`), `eval`, or `find -name`
- Broad listings that don't single out `.env`: `ls .*`, `ls .git*`,
  `ls .config*`
- Every other tool (`Edit`, `Write`, etc.) — passes through untouched

## Known limitations

Honest about what this skill **cannot** catch:

- **Blind reads via piping:** `find . | xargs cat` or
  `ls -A | while read f; do cat "$f"; done` — the `.env` path is selected
  at runtime, never appearing literally in the command. No text scan can
  catch these without false positives on every `cat`.
- **Symbolic links:** a symlink at a non-`.env` path that points at `.env`
  is read as the symlink name; the hook sees only the link path.
- **Encoded paths:** `cat $(echo Lk5LmVudg== | base64 -d)` and similar
  encodings.
- **Process-launched subagents:** if the agent invokes a separate process
  (e.g. an editor, a Python script) that itself reads `.env`, the hook
  only sees the outer command.

Treat this as a meaningful **defense in depth** layer that handles the
common cases — not as an airtight guarantee. Pair it with `.gitignore`
hygiene, OS-level file permissions, sandboxing, and a secrets manager.

## Install

```sh
npx skills add zcaceres/skills -s safety-dotenv-guard
~/.claude/skills/safety-dotenv-guard/scripts/install.sh
```

The second step wires this skill's `PreToolUse:Read|Bash|Grep|Glob` hook
into `~/.claude/settings.json` so it fires on every matching tool call,
not just when this skill is active in context. The script is idempotent,
backs up the target file with a timestamp, and is a no-op if the hook is
already wired. Flags: `--project`, `--target PATH`. Requires `jq`.

Frontmatter `hooks:` blocks fire only while the skill is loaded into
context, so they're not real always-on protection — `install.sh` closes
that gap. See
[`safety-rm-rf-guard`'s Install section](../safety-rm-rf-guard/SKILL.md#install)
for the full explanation.

Verify it's wired by asking Claude Code to read a `.env` file in any
project (after a restart); the hook prints `BLOCKED: …` on stderr and
exit-2s.

### Manual wiring (alternative)

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Read|Bash|Grep|Glob",
        "hooks": [
          { "type": "command", "command": "<path>/safety-dotenv-guard/scripts/run.sh" }
        ]
      }
    ]
  }
}
```

On Windows, point at `scripts\\run.cmd` instead.

## Prerequisites

None at runtime — pre-built Bun binaries ship in `scripts/bin/`. When the
agent is blocked, the recommended workflow is:

- Read secrets from the OS environment (`process.env.FOO`, `$FOO`) rather
  than the file
- Use a secrets manager (1Password, AWS Secrets Manager, Doppler, etc.)
- Read `.env.example` to learn the variable names, then set them yourself

## How it works

1. Claude Code invokes `scripts/run.sh` before every `Read`, `Bash`, `Grep`,
   or `Glob` tool call (after manual wiring — see [Install](#install)).
2. `run.sh` picks the right bundled binary for the host OS/arch from
   `scripts/bin/` (darwin-arm64, linux-x64, or windows-x64.exe).
3. The binary reads the JSON payload from stdin and inspects
   `tool_name` + `tool_input`.
4. For `Read`, the basename of `file_path` is checked against the blocked
   `.env` pattern and the template allowlist.
5. For `Bash`, quoted substrings are stripped first, then the remaining
   command is scanned for `.env` tokens; each token is checked against the
   same blocklist/allowlist.
6. For `Grep` and `Glob`, the path/glob/pattern arguments are scanned the
   same way.
7. If any blocked `.env` reference is found, exit 2 with an explanatory
   stderr message — Claude Code rejects the tool call. Otherwise exit 0.
