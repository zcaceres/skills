---
name: investigate-repo
description: Audit an unfamiliar code repo (GitHub URL) for malicious patterns — clone shallow, grep, emit a verdict with file:line evidence. Use when user asks to investigate, audit, or vet a repo.
allowed-tools: Read, Grep, Glob, Bash, WebFetch
---

# investigate-repo

Deep security and quality audit of an unfamiliar code repository. Clone locally, walk the tree, and report concrete findings with file:line citations. Goal: give the user a defensible "safe / suspicious / dangerous" verdict, not a vibe check.

## When to Use This Skill

Trigger when the user:
- Shares a GitHub/GitLab/Bitbucket URL and asks whether it's safe, malicious, legit, trustworthy, or worth using
- Says "investigate this repo", "audit this repo", "look for security problems in", "check for malicious code", "vet this dependency / package / SDK"
- Asks for a code-quality assessment of an unfamiliar third-party project
- Is about to install, fork, or run code from a repo they don't already trust

Do NOT use for: the user's own repo, code review of a PR, refactoring tasks, or general "is library X good" questions where no specific repo is named.

## Operating Principles

- **Evidence over vibes.** Every finding must cite a file path and (where possible) line numbers.
- **Read-only on the clone.** Never edit, run, install, or execute code from the target repo. No `npm install`, no `pip install`, no `bun install`, no running scripts. Static analysis only.
- **Clone to a throwaway location** under `/tmp` or `$TMPDIR`. Never clone into the user's working directory.
- **Bias toward "explain what's actually there"**, not toward exoneration or condemnation. If something looks bad but is benign on inspection, say so and show why.
- **Time-box.** A deep audit on a medium repo should finish in one pass — don't grep the same patterns repeatedly across the tree.

## Workflow

### 1. Resolve the target

If the user gave a URL, extract `owner/repo`. If they gave only a name, ask which repo (1 question, enumerated).

Fetch repo metadata before cloning so you can size the job and spot red flags:

```bash
gh repo view <owner>/<repo> --json name,description,createdAt,updatedAt,pushedAt,stargazerCount,forkCount,isArchived,isFork,licenseInfo,defaultBranchRef,primaryLanguage,diskUsage 2>/dev/null
```

If `gh` isn't available or the repo is private/inaccessible, fall back to `WebFetch` on the GitHub repo page.

Flag immediately (but keep going):
- Account age < 6 months
- Last push > 2 years ago combined with active "use me" framing
- Very few stars but aggressive marketing language in README
- No license / unusual license
- Repo is a fork of a more popular project (possible typosquat)

### 2. Clone shallow into a temp dir

```bash
TARGET_DIR="$(mktemp -d -t investigate-repo-XXXXXX)"
git clone --depth 50 --no-tags https://github.com/<owner>/<repo>.git "$TARGET_DIR/repo"
```

Record `$TARGET_DIR` and use it for every subsequent command. Never `cd` into it for edits.

### 3. Map the repo

```bash
# Top-level layout
ls -la "$TARGET_DIR/repo"

# File counts by extension (helps spot bundled minified blobs)
find "$TARGET_DIR/repo" -type f -not -path '*/.git/*' \
  | sed -E 's/.*\.([A-Za-z0-9]+)$/\1/' | sort | uniq -c | sort -rn | head -30

# Largest files (often where obfuscated payloads hide)
find "$TARGET_DIR/repo" -type f -not -path '*/.git/*' -printf '%s %p\n' 2>/dev/null \
  | sort -rn | head -20
```

On macOS `find -printf` is unavailable — use `find ... -exec stat -f '%z %N' {} \;` instead.

### 4. Read the headline files first

In this order, read fully (not just skim):
1. `README*` — what does it claim to do?
2. `package.json` / `pyproject.toml` / `Cargo.toml` / `go.mod` / `requirements.txt` — declared deps and scripts
3. `.github/workflows/*` — CI may run on contributor machines
4. Any `install*`, `setup*`, `postinstall*`, `preinstall*` scripts
5. Entry point(s) named in the manifest (`main`, `bin`, etc.)
6. `LICENSE`

Compare README claims against actual code surface area. A "simple browser SDK" with native binaries, install scripts, and outbound HTTP calls is a smell.

### 5. Run the malicious-pattern sweep

Use ripgrep (`rg`) if installed, otherwise `grep -rEn`. Search the whole tree minus `.git`, `node_modules`, `dist`, `build`, `vendor`. For each hit, **open the file and read context** — do not report raw grep lines as findings.

**Code execution / dynamic loading:**
```bash
rg -n --hidden -g '!.git' -g '!node_modules' -g '!dist' -g '!build' \
  -e '\beval\s*\(' \
  -e 'new\s+Function\s*\(' \
  -e 'child_process' -e 'execSync' -e 'spawnSync' -e 'execFile' \
  -e 'os\.system' -e 'subprocess\.(Popen|call|run)' -e '__import__\s*\(' \
  -e 'pickle\.loads' -e 'marshal\.loads' -e 'yaml\.load\b' \
  -e 'Runtime\.getRuntime\(\)\.exec' \
  "$TARGET_DIR/repo"
```

**Network exfiltration / beacons:**
```bash
rg -n --hidden -g '!.git' -g '!node_modules' \
  -e 'fetch\s*\(' -e 'axios\.' -e 'XMLHttpRequest' \
  -e 'requests\.(get|post)' -e 'urllib' -e 'http\.client' \
  -e 'net\.Socket' -e 'dgram' -e 'WebSocket\s*\(' \
  -e '\bhttps?://[^"'\'' ]+' \
  "$TARGET_DIR/repo"
```

Then `sort -u` the URLs and ask: are these documented? Do they go to the project's own domain, or somewhere unexplained?

**Credential / token harvesting:**
```bash
rg -n -e 'process\.env\b' -e 'os\.environ' \
  -e '\.npmrc' -e '\.aws/credentials' -e 'id_rsa' -e '\.ssh/' \
  -e 'keychain' -e 'LocalStorage' -e 'document\.cookie' \
  -e 'Authorization\s*[:=]' -e 'Bearer\s+' \
  "$TARGET_DIR/repo"
```

**Obfuscation:**
```bash
# Long base64-looking strings
rg -n --pcre2 '[A-Za-z0-9+/]{200,}={0,2}' "$TARGET_DIR/repo"
# \x-encoded blobs
rg -n '(\\x[0-9a-fA-F]{2}){20,}' "$TARGET_DIR/repo"
# Hex blobs
rg -n '[0-9a-fA-F]{200,}' "$TARGET_DIR/repo"
# Minified JS shipped as source (extremely long lines)
find "$TARGET_DIR/repo" -name '*.js' -not -path '*/node_modules/*' \
  -exec awk 'length>5000 {print FILENAME":"NR":"length; nextfile}' {} \;
```

**Install-time / build-time hooks** (highest risk — run with user privileges on `npm install`):
```bash
# package.json scripts
rg -n --json '"(preinstall|install|postinstall|prepare)"\s*:' \
  "$TARGET_DIR/repo" --type-add 'json:*.json' -tjson || \
rg -n '"(preinstall|install|postinstall|prepare)"\s*:' "$TARGET_DIR/repo" -g '*.json'

# Python equivalents
rg -n -e 'setup\.py' -e 'cmdclass' -e 'PostInstallCommand' "$TARGET_DIR/repo"
```

**Binary payloads / native code:**
```bash
find "$TARGET_DIR/repo" -type f \
  \( -name '*.exe' -o -name '*.dll' -o -name '*.so' -o -name '*.dylib' \
     -o -name '*.node' -o -name '*.wasm' -o -name '*.bin' \) \
  -not -path '*/node_modules/*' -not -path '*/.git/*'
```

For each binary, check whether it's referenced from code, whether a source build exists, and whether the README explains its provenance.

### 6. Dependency review

```bash
# Node
[ -f "$TARGET_DIR/repo/package.json" ] && cat "$TARGET_DIR/repo/package.json" | head -100
# Python
[ -f "$TARGET_DIR/repo/requirements.txt" ] && cat "$TARGET_DIR/repo/requirements.txt"
[ -f "$TARGET_DIR/repo/pyproject.toml" ] && cat "$TARGET_DIR/repo/pyproject.toml"
```

For each declared dependency, flag:
- Git URLs or tarball URLs (bypasses registry review)
- Typosquats of popular packages (e.g. `reqests`, `lodahs`)
- Pinned to a single commit hash with no version
- Dependencies you've never heard of doing low-level system work

Do **not** run `npm audit` / `pip-audit` — that requires install. Note the limitation in the report.

### 7. Git history sanity check

```bash
# Recent commit cadence and authors
git -C "$TARGET_DIR/repo" log --pretty='%h %ad %ae %s' --date=short -n 30

# Any force-push markers, mass rewrites?
git -C "$TARGET_DIR/repo" log --all --pretty='%h %s' -n 50 | grep -iE 'force|rewrite|squash' | head

# Single-author repo? (concentration risk)
git -C "$TARGET_DIR/repo" shortlog -sne HEAD | head
```

### 8. Synthesize the report

Output a markdown report in the chat with this exact structure:

```
# investigate-repo: <owner>/<repo>

**Verdict:** SAFE / SUSPICIOUS / DANGEROUS / INCONCLUSIVE — one line of justification.

## Repo at a glance
- Stars / forks / age / last push / license / primary language
- Stated purpose (1 sentence from README)
- What the code actually does (1 sentence from inspection)

## Findings

### 🔴 Critical (would block adoption)
- `path/to/file.ts:42` — concrete description of what's there and why it's a problem.

### 🟡 Concerning (warrants follow-up)
- ...

### 🟢 Notes (worth knowing, not blocking)
- ...

## What I did NOT check
- Runtime behavior (no execution performed)
- Transitive dep CVEs (no install performed)
- Anything else skipped or inconclusive

## Recommendation
Concrete next step: safe to use as-is / safe to use with sandboxing / fork-and-audit-first / avoid.
```

Keep findings concrete. "Uses eval" is not a finding; "`src/loader.js:88` calls `eval()` on a string fetched from `https://cdn.example.com/payload.js` at runtime — this is a remote code execution channel" is a finding.

### 9. Cleanup

Tell the user the clone path and ask before deleting. If they approve:

```bash
trash "$TARGET_DIR"  # if `trash` is available, else: rm -rf "$TARGET_DIR"
```

## Red Flag Reference (what "looks bad" actually means)

- **Postinstall scripts that touch the network, the filesystem outside the package dir, or env vars** — classic npm supply-chain attack pattern.
- **`eval` / `new Function` on remote-fetched strings** — remote code execution.
- **Base64/hex blobs > 1KB in source files** that aren't documented test fixtures or assets.
- **Hardcoded URLs to pastebin, requestbin, ngrok, discord webhooks, telegram bots, raw IP addresses.**
- **Reading `~/.ssh`, `~/.aws`, `~/.npmrc`, browser profile dirs, keychain** — credential theft.
- **Native binaries with no build script** — opaque payload.
- **Single commit history, or all commits within a 24h window** for a repo claiming maturity.
- **Author account created same week as the repo** with no other activity.
- **README describes a benign-sounding wrapper, code is mostly hooks/instrumentation.**

## Anti-Patterns (do NOT do these)

- Do not run `npm install` / `pip install` / `bun install` / build scripts — that's the exact thing the user is trying to avoid.
- Do not `cd` into the cloned repo and start editing.
- Do not declare a repo "safe" because nothing showed up in grep — say "no obvious red flags in static analysis" and list what wasn't checked.
- Do not declare a repo "dangerous" based on pattern hits alone without reading the surrounding code.
- Do not skip the README-vs-code reality check. Many malicious packages look fine to grep and only fail the smell test.

## Examples

### Example 1: "Is this repo safe?"

User: "Please carefully investigate https://github.com/SomeOrg/some-sdk — look closely for security problems or malicious code."

Action:
1. `gh repo view SomeOrg/some-sdk --json ...`
2. Clone shallow to `/tmp/investigate-repo-XXXX/repo`
3. Walk tree, run pattern sweeps, read entry points
4. Produce the structured report with verdict + cited findings
5. Offer to delete the clone

### Example 2: User gives only a name

User: "Check out CloakBrowser, is it sketchy?"

Action: Ask which repo (likely `CloakHQ/CloakBrowser`), confirm, then proceed as Example 1.

### Example 3: Repo is huge

If `diskUsage > 200000` (200MB) or file count > 10k, narrow the deep-read pass to: manifest files, install scripts, entry points named in manifest, top-level `src/` and `lib/`, plus all files matching the malicious-pattern sweep. Note the scope reduction in the report's "What I did NOT check" section.

## Technical Details

- **Dependencies:** `git`, `gh` (optional), `rg` (preferred) or `grep`, `find`. macOS-aware (`stat -f` vs `find -printf`).
- **No execution:** This skill never runs code from the target repo. No installs, no builds, no test runs.
- **Clone location:** Always `$(mktemp -d)` — never the user's cwd.
- **Output:** Markdown report inline in chat. Do not write report files unless the user asks.
