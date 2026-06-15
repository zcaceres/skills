---
name: quality-dead-code-analyzer
description: Analyze a codebase for dead code, duplicates, and circular dependencies using knip, jscpd, and madge, then validate findings to filter false positives. Use when user says "quality-dead-code-analyzer", "analyze code", "find dead code", "code cleanup", "find duplicates", "unused exports", or "static analysis".
---

# Dead Code Analyzer

Runs three static analysis tools sequentially, then validates findings to filter out false positives.

**Tools used:**
- **knip** - Dead code, unused exports, unused dependencies
- **jscpd** - Duplicate code blocks
- **madge** - Circular dependencies

The tools are fetched on demand with a package runner — nothing is installed into the project or the skill.

## Important: Run Tools Directly

**DO NOT use Task agents for this skill.** Run all tools directly in the main context using Bash. This prevents infinite retry loops and token waste.

## Workflow

### Step 1: Pick a Package Runner

The tools run via `npx` (npm). If `npx` is unavailable, fall back to `bunx` (Bun) — the arguments are identical. Set a `RUN` variable once and reuse it:

```bash
RUN="npx --yes"; command -v npx >/dev/null 2>&1 || RUN="bunx"
echo "Using: $RUN"
```

Major versions are pinned (`knip@5`, `jscpd@4`, `madge@8`) so results stay stable.

### Step 2: Gather Project Context

Read the target project's package.json to understand it:

```bash
cat package.json
```

Note these details for validation:
- **Framework**: `next`, `react`, `vue`, `angular` in dependencies
- **Runtime**: Look for `bun.lockb` or `"bun"` in scripts
- **Scripts that use tools indirectly**:
  - `"lint": "next lint"` → eslint is used
  - `"test": "bun test --preload ./preload.ts"` → preload.ts is used
- **Config files**: `ls *.config.* tsconfig.json 2>/dev/null`

### Step 3: Run Analysis Tools (Sequentially)

Run each tool ONE TIME with the exact commands below. If a tool fails, report the error and move on.

#### Tool 1: knip (Dead Code)

```bash
$RUN knip@5 --reporter json --no-progress 2>&1 | head -500
```

**Flags explained:**
- `--reporter json` - Machine-readable output
- `--no-progress` - Disable dynamic terminal updates (required for non-TTY)

**Parse the JSON output for:**
- `files` array - Unused files
- `issues[].dependencies` - Unused dependencies
- `issues[].devDependencies` - Unused devDependencies
- `issues[].exports` - Unused exports
- `issues[].unlisted` - Unlisted dependencies (false positives for framework-provided packages)

#### Tool 2: madge (Circular Dependencies)

```bash
$RUN madge@8 --circular --json --extensions ts,tsx --ts-config tsconfig.json --no-spinner src 2>&1
```

**Flags explained:**
- `--circular` - Find circular dependencies
- `--json` - Machine-readable output
- `--extensions ts,tsx` - Only analyze TypeScript files
- `--ts-config tsconfig.json` - Use project's tsconfig for path resolution
- `--no-spinner` - Disable progress spinner
- `src` - Analyze the src directory

**Output:** Returns `[]` if no circular deps, or array of dependency chains.

#### Tool 3: jscpd (Duplicate Code)

```bash
$RUN jscpd@4 src --min-lines 10 --min-tokens 100 --reporters json --silent --gitignore --max-size 500kb -o /tmp/jscpd-report 2>&1
```

Then read the report:
```bash
cat /tmp/jscpd-report/jscpd-report.json | head -200
```

**Flags explained:**
- `--min-lines 10` - Minimum 10 lines to count as duplicate (default 5 is too noisy)
- `--min-tokens 100` - Minimum 100 tokens (default 50 is too noisy)
- `--reporters json` - JSON output
- `--silent` - No progress output
- `--gitignore` - Respect .gitignore
- `--max-size 500kb` - Handle larger files (default 100kb skips many files)
- `-o /tmp/jscpd-report` - Write to temp dir, not project

**Parse the report for:**
- `statistics.total.clones` - Number of duplicate blocks
- `statistics.total.duplicatedLines` - Total duplicated lines
- `duplicates` array - Specific duplicate pairs with file paths and line ranges

### Step 4: Validate Findings

After running all tools, validate each finding using Grep to filter false positives.

#### For Unused Dependencies:
```bash
# Check if package is imported anywhere
rg "from ['\"]package-name" src/
# Check if used in scripts
grep "package-name" package.json
```

**Classify as:**
- **HIGH confidence**: 0 imports in src/ AND not in scripts
- **FALSE POSITIVE**: Used in scripts (e.g., eslint via "next lint")
- **FALSE POSITIVE**: Framework-provided (e.g., "server-only" in Next.js)

#### For Unused Files:
```bash
# Check if file is imported anywhere
rg "from.*filename" src/
# Check if referenced in configs
grep -r "filename" *.config.* tsconfig.json package.json 2>/dev/null
```

**Classify as:**
- **HIGH confidence**: 0 imports AND not in config AND not in scripts
- **FALSE POSITIVE**: Used by scripts (e.g., preload.ts for bun test)

### Step 5: Present Validated Results

```markdown
## Code Cleanup Analysis (Validated)

### High Confidence - Safe to Remove

| Item | Type | Verification |
|------|------|--------------|
| react-icons | dependency | 0 imports in src/, not in scripts |
| src/components/OldComponent.tsx | file | 0 imports found |

### Circular Dependencies
[List any chains found by madge]

### Duplicate Code
[List significant duplicates from jscpd, skip test files and docs]

### Filtered Out (Not Issues)
- `eslint`: Used by `next lint` script
- `server-only`: Provided by Next.js
- `preload.ts`: Used by `bun test --preload` script
```

### Step 6: Cleanup (If Requested)

If user wants to proceed:
1. Use `AskUserQuestion` to confirm which items to remove
2. Edit package.json to remove dependencies
3. Use `trash` command to delete unused files (not `rm`)
4. Run `bun install` to update lockfile
5. Run `bun run typecheck` to verify no breakage

## Common False Positives

### Next.js Projects
- `eslint`, `eslint-config-next` → used by `next lint` script
- `server-only` → provided by Next.js, shows as "unlisted" but is valid
- `postcss`, `autoprefixer` → used by Next.js CSS processing
- Files in `app/` with special names (layout, page, loading, error) → framework conventions

### Bun Projects
- `preload.ts` → used by `bun test --preload`
- Many `@types/*` packages → Bun provides built-in types

### Testing
- `@faker-js/faker`, `@testing-library/*` → only in test files is OK
- Test file duplication → often intentional for test clarity

### shadcn/ui Projects
- Unused `@radix-ui/*` packages → installed by CLI but component not yet used
- UI component files → installed but not yet used (suggest removal)

### Documentation
- `CLAUDE.md` <-> `GEMINI.md` duplication → intentional
- README duplication in monorepos → intentional
