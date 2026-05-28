# Reflection Examples

This document provides examples of conversation retrospectives using the `reflect-on-conversation` skill.

---

## Example 1: Debugging a React Component Issue

**Context**: User asked for help debugging a React component that wasn't updating properly. Conversation took 15 messages to resolve.

### 🛠️ Top 3: New Skills, Tools & Tooling

1. **React DevTools MCP Server**: An MCP server that can inspect React component state, props, and re-render patterns directly from the conversation. Would have identified the stale closure issue in message 3 instead of message 12.

2. **Component State Tracer Script**: A CLI tool that instruments components with logging to track state changes and prop updates over time. Could be invoked via `npx trace-component ComponentName`.

3. **React Anti-Pattern Linter Skill**: A skill that scans for common React pitfalls (stale closures, missing dependencies, unnecessary re-renders) and provides specific file/line references with fixes.

### 🚀 Top 3: Prompting & Context

1. **Include Component File Upfront**: Instead of "My component isn't updating", provide: "The UserProfile component in `src/components/UserProfile.tsx` isn't reflecting state changes. Here's the file: [paste or reference file]". This saves 3-4 message round-trips.

2. **Describe Expected vs Actual Behavior**: Specify what should happen and what's actually happening: "When I click the button, the count should increment from 0 to 1, but it stays at 0." This prevents the agent from guessing.

3. **Share Minimal Reproduction**: If possible, note: "This happens in the ProfilePage, but I've also seen it in the SettingsPage with similar state logic." Patterns help the agent identify root causes faster.

### ✨ Top 3: Other Suggestions

1. **Use Plan Mode for Debugging**: Complex debugging benefits from planning. The agent should have proposed a debugging plan (check state, review hooks, trace data flow) before diving into code changes.

2. **Document the Fix**: After resolving the stale closure issue, the agent should have suggested adding a comment or updating the team's React patterns documentation to prevent recurrence.

3. **Verify the Fix**: The agent should have proactively asked "Would you like me to help you write a test to prevent this regression?" instead of just fixing the immediate issue.

---

### 🤖 Agent Course Correction

**Message 5-7**: The agent searched for state management patterns but didn't actually read the component file yet. Should have read the file first before theorizing about Redux/Context issues.

**Message 10**: When the user mentioned "it worked before the refactor," the agent should have immediately asked about the git diff or recent changes instead of continuing to debug the current state.

**Message 14**: The agent suggested using `useCallback` before confirming the actual problem was a stale closure in `useEffect`. Should have traced the dependency array issue first.

### 📚 Documentation & Knowledge

**New Documentation Needed**:
- `docs/react-hooks-patterns.md`: Document common pitfalls with `useEffect` dependencies, stale closures, and how to debug them
- Update `CLAUDE.md`: Add section on "Debugging Protocol" - always read the actual file before proposing theories

**Context Gaps**:
- The agent wasn't aware of the project's recent refactor from class components to hooks. This context would have immediately pointed to likely hook-related issues.

### 🔄 Workflow & Process

**Efficiency**:
- Messages 1-4: Efficient - good clarifying questions
- Messages 5-9: Inefficient - theorizing without reading code (wasted ~5 messages)
- Messages 10-15: Efficient - focused debugging after reading the file

**Rabbit Hole**: Message 7 diverged into discussing global state management when the issue was component-local. Divergence triggered by the word "state" without clarifying scope.

**Planning Gap**: Should have created a debugging plan after message 4:
1. Read component file
2. Check useEffect dependencies
3. Trace data flow
4. Verify props aren't stale

### 💡 Technical Retrospective

**Alternative Approaches**:
- Could have used the `eslint-plugin-react-hooks` exhaustive-deps rule from the start - would have caught the missing dependency
- The project uses React DevTools in development; agent could have suggested using the Profiler to identify unnecessary re-renders as part of diagnosis

**Better Pattern**: Instead of fixing the specific `useEffect`, could have suggested migrating to React Query or SWR for data fetching, which handles dependencies and stale data automatically.

### ✅ Next-Time Checklist

For React debugging tasks:
- [ ] Read the component file before theorizing about the bug
- [ ] Check `package.json` for React version and related libraries
- [ ] Review recent git commits if user mentions "it worked before"
- [ ] Look for common hook pitfalls: dependency arrays, stale closures, incorrect `useEffect` placement
- [ ] Suggest running ESLint rules for hooks if not already in the build
- [ ] Propose tests to prevent regression after fixing

---

## Example 2: Adding a New API Endpoint

**Context**: User requested adding a new REST API endpoint for user profile updates. Completed in 8 messages.

### 🛠️ Top 3: New Skills, Tools & Tooling

1. **API Endpoint Generator Skill**: A skill that scaffolds new endpoints following the project's patterns - creates route file, controller, validation schema, and test file with one invocation.

2. **Schema Validator Script**: Given a Zod schema, generates example valid/invalid payloads for testing. Useful for quickly validating API contracts.

3. **OpenAPI Spec Updater**: Automatically updates the project's OpenAPI/Swagger spec when new endpoints are added, keeping documentation in sync.

### 🚀 Top 3: Prompting & Context

1. **Reference Similar Endpoints**: Instead of "Add an endpoint to update profiles", say: "Add a PATCH endpoint for user profiles similar to the existing PATCH /api/users/:id endpoint, but only allowing bio and avatar updates." This immediately establishes patterns to follow.

2. **Specify Validation Requirements**: Include constraints upfront: "Bio should be max 500 chars, avatar must be a valid URL, and both fields are optional." Prevents back-and-forth about validation rules.

3. **Clarify Auth Requirements**: State: "This endpoint requires JWT authentication and users can only update their own profile." Security requirements should be explicit from message 1.

### ✨ Top 3: Other Suggestions

1. **Read Existing Patterns First**: The agent should proactively search for existing similar endpoints to maintain consistency before writing new code.

2. **Suggest Integration Tests**: After implementing the endpoint, the agent should offer to add integration tests covering success cases, validation failures, and auth scenarios.

3. **Update API Documentation**: The agent should ask: "Should I update the API documentation in `docs/api.md` with this new endpoint?" rather than only adding code.

---

### 🤖 Agent Course Correction

**Message 3**: The agent created the route file but used a different naming convention than the existing codebase (`user-profile.routes.ts` vs the project's `userProfile.routes.ts` pattern). Should have searched for existing route files first.

**Message 6**: When adding Zod validation, the agent used inline schema definition instead of the project's pattern of defining schemas in `src/schemas/`. Should have checked the project structure.

### 📚 Documentation & Knowledge

**Documentation Suggestions**:
- `docs/adding-endpoints.md`: Step-by-step guide for adding new API endpoints, including file structure, naming conventions, validation patterns, testing requirements
- Update `CLAUDE.md`: Add "API Development Patterns" section referencing the Zod schema location and route file conventions

**Context Gaps**:
- The agent wasn't aware that this project uses tRPC for some endpoints and REST for others. Documentation on when to use which approach would have been helpful.

### 🔄 Workflow & Process

**Efficiency**:
- Messages 1-2: Efficient - clear requirements gathering
- Message 3: Minor inefficiency - used wrong naming convention, required a fix in message 4
- Messages 5-8: Very efficient - validation, controller, and tests added smoothly

**No Rabbit Holes**: Conversation stayed focused throughout.

**Planning**: Implicit plan was adequate for this straightforward task. Agent followed a logical sequence (route → validation → controller → tests).

### 💡 Technical Retrospective

**Alternative Approaches**:
- Could have used tRPC instead of REST, which would provide end-to-end type safety and automatic validation
- The project already uses `express-validator` in some places and Zod in others - should have discussed standardizing on one approach

**Pattern Consistency**: The new endpoint follows REST conventions, but the project is gradually migrating to tRPC. Should have flagged this during implementation and asked about the migration strategy.

### ✅ Next-Time Checklist

For adding API endpoints:
- [ ] Search for similar existing endpoints to understand patterns
- [ ] Check naming conventions for route files, controllers, and schemas
- [ ] Verify whether to use REST, tRPC, or GraphQL for this project
- [ ] Identify where validation schemas should be defined
- [ ] Plan for integration tests covering success, validation, and auth cases
- [ ] Ask about updating API documentation
- [ ] Consider whether the endpoint needs rate limiting or caching

---

## Example 3: Performance Optimization Task

**Context**: User reported slow page load times and asked for optimization help. Required 20+ messages due to scope creep.

### 🛠️ Top 3: New Skills, Tools & Tooling

1. **Performance Profiler Skill**: Integrates with Chrome DevTools, Lighthouse, and Web Vitals to automatically run performance audits and identify bottlenecks. Could parse Lighthouse JSON reports and provide prioritized recommendations.

2. **Bundle Analyzer MCP Server**: Connects to webpack-bundle-analyzer or similar tools to identify large dependencies, code splitting opportunities, and tree-shaking issues without manual analysis.

3. **Image Optimization Script**: Scans for unoptimized images, generates WebP/AVIF versions, suggests lazy loading opportunities, and creates `next/image` configurations automatically.

### 🚀 Top 3: Prompting & Context

1. **Provide Performance Metrics Upfront**: Share Lighthouse scores, Core Web Vitals, or profiler screenshots in the first message: "First Contentful Paint is 3.2s (should be <1.8s), Total Blocking Time is 850ms." This focuses the investigation immediately.

2. **Define Success Criteria**: State: "Goal is to get Lighthouse performance score from 45 to 85+" or "Reduce initial bundle size from 850KB to under 300KB." Clear targets prevent endless optimization.

3. **Specify Constraints**: Mention limitations: "Can't remove the analytics library" or "Need to support IE11" so the agent doesn't suggest incompatible optimizations.

### ✨ Top 3: Other Suggestions

1. **Use Plan Mode for Performance Work**: Performance optimization is exploratory and benefits from creating a plan (audit → prioritize → implement → measure) before making changes.

2. **Measure Before and After**: The agent should have asked to establish baseline metrics and verify improvements after each change instead of making multiple optimizations without validation.

3. **Prevent Scope Creep**: After message 10, the conversation shifted from "page load" to "general code quality." The agent should have checked: "This is beyond performance optimization - should we create a separate task for code quality improvements?"

---

### 🤖 Agent Course Correction

**Message 4**: The agent suggested code splitting without first running a bundle analysis to see if that was actually the bottleneck. Should have profiled first.

**Messages 8-12**: The agent made multiple optimization suggestions simultaneously (code splitting, image optimization, lazy loading, removing unused CSS) without prioritizing by impact. Should have created a prioritized list based on profiler data.

**Message 15**: When the user mentioned "code smells," the agent immediately started refactoring unrelated code instead of asking: "Should we focus on performance first and address code quality separately?"

### 📚 Documentation & Knowledge

**Documentation Needed**:
- `docs/performance-optimization-guide.md`: Playbook for performance work including profiling steps, common bottlenecks in this stack (Next.js), measuring impact, and optimization checklist
- Update `CLAUDE.md`: Add "Performance Debugging Protocol" - always profile before optimizing, measure each change, maintain scope focus

**Missing Knowledge**:
- The agent didn't know that this Next.js project uses Vercel's Edge Network - could have suggested Edge Functions or ISR for performance gains
- Documentation on the project's performance budget and monitoring would have helped set clear targets

### 🔄 Workflow & Process

**Efficiency**:
- Messages 1-3: Good - identified the general area of concern
- Messages 4-14: Inefficient - scattered optimizations without profiling data (wasted ~8 messages)
- Messages 15-20: Rabbit hole - scope creep into code quality

**Rabbit Hole**: Message 15 - user mentioned "the code could be cleaner too" and the agent interpreted this as a request to start refactoring. Should have clarified scope.

**Planning Gap**: Should have created a detailed plan after message 3:
1. Run Lighthouse audit
2. Analyze bundle size with webpack-bundle-analyzer
3. Profile runtime performance with Chrome DevTools
4. Prioritize top 3 issues by impact
5. Implement fixes one at a time
6. Measure improvement after each fix

### 💡 Technical Retrospective

**Alternative Approaches**:
- Could have used Next.js's built-in performance monitoring and Vercel Analytics to get real user metrics instead of just dev environment profiling
- The project uses `lodash` which is known for large bundle size - should have suggested `lodash-es` or individual imports earlier

**Better Architecture**: Some performance issues stemmed from client-side data fetching. Could have suggested migrating to Next.js App Router with Server Components to move more logic server-side.

### ✅ Next-Time Checklist

For performance optimization tasks:
- [ ] Get baseline metrics (Lighthouse, bundle size, profiler data) before making changes
- [ ] Define clear success criteria and performance budget
- [ ] Run bundle analyzer and profiler to identify actual bottlenecks
- [ ] Create a prioritized plan ordered by impact (biggest wins first)
- [ ] Make one change at a time and measure improvement
- [ ] Stay focused on performance; defer unrelated improvements to separate tasks
- [ ] Document optimizations and benchmarks for future reference
- [ ] Consider monitoring/alerting to prevent regression

---

## Using These Examples

These examples illustrate how the reflection skill:

1. **Identifies Tooling Opportunities**: Recognizes patterns that could be automated
2. **Improves Prompting**: Shows how better initial context saves message round-trips
3. **Highlights Process Issues**: Calls out efficiency problems, rabbit holes, and planning gaps
4. **Offers Course Corrections**: Points out where the agent should have acted differently
5. **Suggests Documentation**: Identifies knowledge that should be captured
6. **Provides Checklists**: Creates reusable guides for similar future tasks

When using the skill yourself, you'll get a retrospective tailored to your specific conversation with the same structure and level of detail.
