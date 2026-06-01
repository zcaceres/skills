---
name: perf-review
description: Analyze a codebase for performance bottlenecks in full-stack web applications. Use when user says "perf review", "performance review", "find bottlenecks", "optimize performance", "slow code", "performance audit", or "why is my app slow". Interactive workflow that discusses each finding before moving on.
---

# Performance Review Skill

Analyze a full-stack web application for real performance bottlenecks. Focus on evidence-based issues, not generic suggestions. Interactive workflow that discusses each finding with the user.

## When to Use This Skill

Use this skill when the user requests:
- "Perf review" / "Performance review"
- "Find bottlenecks"
- "Optimize performance"
- "Why is my app slow?"
- "Performance audit"
- "Slow code analysis"

## Core Principles

1. **Evidence over intuition**: Only flag issues you can prove are bottlenecks
2. **Impact over quantity**: Fewer high-impact findings beat many micro-optimizations
3. **Safety first**: Every suggestion must not change functionality
4. **Interactive review**: Discuss each finding before moving to the next

---

## Workflow

### Phase 1: Project Discovery

Before analyzing, understand the project:

```bash
# Detect project type
ls package.json bun.lockb yarn.lock pnpm-lock.yaml 2>/dev/null

# Check for existing benchmarks
find . -name "*.bench.ts" -o -name "*.benchmark.ts" -o -name "bench.ts" 2>/dev/null

# Check for profiling config
ls .clinic clinic.json 0x.json 2>/dev/null

# Check frontend framework
grep -l "react\|vue\|svelte\|next\|nuxt" package.json 2>/dev/null
```

Inform the user:
- "I'll analyze [project type] for performance issues."
- "Found existing benchmarks: [list] / No existing benchmarks found."
- "I'll focus on [backend/frontend/both] based on your project structure."

### Phase 2: Static Analysis

Analyze code for known performance anti-patterns. Check each category based on what's relevant to the project.

#### Backend Performance Checks

##### 1. Database Queries (N+1, Missing Indexes)

Look for:
- Queries inside loops (N+1 pattern)
- Missing `include`/`join` in ORM queries
- `SELECT *` when only specific columns needed
- Missing pagination on large result sets

```
Grep patterns:
- "\.find\(" inside forEach/map/for loops
- "await.*query" inside loops
- "SELECT \*" in raw queries
```

##### 2. API Endpoints

Look for:
- Synchronous operations that should be async
- Missing response streaming for large payloads
- Unnecessary serialization/deserialization
- Missing caching headers

##### 3. Memory Patterns

Look for:
- Growing arrays/objects without bounds
- Event listeners not being removed
- Large objects held in closures
- Missing cleanup in long-running processes

##### 4. I/O Operations

Look for:
- `readFileSync` / `writeFileSync` (sync file ops)
- Unbuffered streams
- Missing compression for responses
- Sequential I/O that could be parallel

##### 5. Event Loop Blocking

Look for:
- CPU-intensive operations in request handlers
- Large JSON.parse/JSON.stringify on main thread
- Synchronous crypto operations
- Missing worker threads for heavy computation

#### Frontend Performance Checks

##### 1. Bundle Size

Look for:
- Large dependencies (moment.js, lodash full import)
- Missing tree-shaking (`import lodash` vs `import { map } from 'lodash'`)
- Duplicate dependencies
- Dev dependencies in production bundle

```bash
# Check bundle size if available
bun build --analyze 2>/dev/null || npx webpack-bundle-analyzer 2>/dev/null
```

##### 2. Rendering Performance

Look for:
- Components re-rendering on every parent render
- Missing `useMemo`/`useCallback` for expensive computations
- Inline object/array creation in JSX props
- Missing `key` props or using index as key

##### 3. Asset Loading

Look for:
- Unoptimized images (missing width/height, no lazy loading)
- Render-blocking CSS/JS
- Missing preload/prefetch for critical resources
- Large fonts loading synchronously

##### 4. Network Efficiency

Look for:
- Waterfall requests (sequential when parallel possible)
- Missing data prefetching
- Over-fetching (requesting more data than needed)
- Missing response caching

### Phase 3: Dynamic Analysis (Ask Permission)

If static analysis is inconclusive, offer to run benchmarks:

```
Question: "I'd like to run some performance measurements to identify bottlenecks more precisely. May I?"
Options:
- "Yes, run benchmarks" - Execute performance tests
- "No, continue with static analysis" - Skip dynamic analysis
- "Tell me what you'd run first" - Explain before executing
```

If approved, depending on project type:

**For Bun/Node backend:**
```bash
# Profile with clinic (if available)
npx clinic doctor -- node server.js

# Or use built-in profiler
node --prof server.js
```

**For frontend:**
```bash
# Measure bundle size
bun build --minify --outdir=dist && du -sh dist/

# Or with webpack
npx webpack-bundle-analyzer stats.json
```

### Phase 4: Interactive Review

For each finding, present it interactively:

#### Finding Format

```markdown
## Finding [N]: [Title]

**Location:** `file/path.ts:123`
**Category:** [Database/Memory/Bundle/etc.]
**Impact:** [High/Medium/Low] - [explanation of impact]

### The Issue
[Code snippet showing the problem]

### Why This Matters
[Explanation with numbers if possible - e.g., "This query runs N times per request"]

### Proposed Fix
[Code snippet showing the fix]

### Safety Assessment
- **Regression risk:** [Low/Medium] - [explanation]
- **Behavior change:** None / [describe any edge case differences]
- **Test coverage:** [covered by X test / not covered]
- **Reversibility:** [easy to revert / requires migration]
```

#### Ask User

After presenting each finding, ask:

```
Question: "How would you like to proceed with this finding?"
Options:
- "Apply this fix" - I'll make the change
- "Skip for now" - Move to next finding
- "Tell me more" - Explain in more detail
- "I'll fix it myself" - Note it and move on
```

### Phase 5: Summary

After reviewing all findings, provide a summary:

```markdown
## Performance Review Summary

### Applied Fixes
1. [Finding 1] - [file:line]
2. [Finding 2] - [file:line]

### Skipped/Deferred
1. [Finding 3] - Reason: [user chose to skip / needs more investigation]

### Estimated Impact
- Database queries: X fewer per request
- Bundle size: -Y KB
- Response time: [estimated improvement]

### Recommended Next Steps
1. [Run the test suite to verify no regressions]
2. [Set up performance monitoring for X]
3. [Consider profiling Y in production]
```

---

## Focus Areas

### DO Focus On

- **Evidence-based issues**: Query counts, bundle sizes, profiler output
- **High-impact patterns**: O(n²) → O(n), N+1 queries, bundle bloat
- **Measurable improvements**: "This will reduce queries from N to 1"
- **Safe optimizations**: Pure performance gains with no behavior change

### DO NOT Focus On

- **Micro-optimizations**: `for` vs `forEach` without evidence
- **Premature optimization**: Caching before proving it's needed
- **Speculative improvements**: "This might be slow" without proof
- **Behavior-changing refactors**: Even if faster, flag don't fix

---

## Safety Guarantees

Before suggesting any fix, verify:

1. **No behavior change**: The output/result must be identical
2. **Test coverage**: Note if the area has tests or needs them
3. **Reversibility**: Prefer easily-revertible changes
4. **Edge cases**: Consider null, empty, concurrent access

If uncertain about safety, present as "potential optimization" requiring user verification rather than a fix to apply.

---

## Examples

### Example: N+1 Query Detection

**Bad (N+1):**
```typescript
const users = await db.user.findMany();
for (const user of users) {
  const posts = await db.post.findMany({ where: { userId: user.id } });
  // ... 100 users = 101 queries
}
```

**Good (single query):**
```typescript
const users = await db.user.findMany({
  include: { posts: true }
});
// 1 query with JOIN
```

### Example: Bundle Size Issue

**Bad (imports entire library):**
```typescript
import _ from 'lodash';
const result = _.map(items, transform);
```

**Good (tree-shakeable):**
```typescript
import { map } from 'lodash-es';
const result = map(items, transform);
```

### Example: Sync File Operation

**Bad (blocks event loop):**
```typescript
app.get('/config', (req, res) => {
  const config = fs.readFileSync('./config.json');
  res.json(JSON.parse(config));
});
```

**Good (non-blocking):**
```typescript
app.get('/config', async (req, res) => {
  const config = await Bun.file('./config.json').json();
  res.json(config);
});
```
