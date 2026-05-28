---
name: reflect-on-conversation
description: Analyze conversation history for a structured retrospective on prompting, agent performance, system gaps, and efficiency. Use when wanting insights to improve collaboration or workflows.
---

# Conversation Reflection & Retrospective

## Overview

Analyze the entire conversation history up to this point and provide a comprehensive, structured retrospective. The goal is to improve collaboration between the User and the Agent, optimize system configuration, and refine the user's prompting strategy.

## Analysis Dimensions

When conducting the reflection, thoroughly examine each of these dimensions:

### 1. User Prompting & Guidance

**Examine:**
- **Clarity & Intent**: Were the user's initial requests and subsequent instructions clear? Could they have been phrased more effectively?
- **Context Provision**: Did the user provide enough context (files, background, constraints) upfront? What context was missing that caused delays?
- **Steering**: How effectively did the user guide the agent? What steering strategies worked best?
- **Actionable Feedback**: Suggest specific rephrasings or prompt patterns for future tasks.
- **Clarifying Questions**: Were the agent's questions to the user effective and necessary?

### 2. Agent Performance & Technical Execution

**Examine:**
- **Reasoning Quality**: Did the agent break down complex problems effectively? Where did reasoning falter?
- **Tool Usage**: Did the agent use the right tools? (e.g., `codebase_search` vs `grep`, parallel vs sequential calls)
- **Proactivity**: Was the agent proactive in identifying issues/improvements?
- **Rule Adherence**: Did the agent follow `.cursor/rules` or `CLAUDE.md`? Are there conflicts?
- **File Navigation**: Was file discovery efficient?
- **Code Quality**: Did the agent adhere to best practices and patterns?
- **Testing & Validation**: Were changes verified? Were tests run or created?

### 3. System, Documentation & Environment

**Examine:**
- **Documentation Gaps**: What knowledge was missing? Suggest new `.mdc` files, documentation, or updates.
- **Tooling Needs**: What manual tasks could be automated (scripts, CLI tools, MCP servers, skills)?
- **Context Window**: Was relevant code easily accessible?
- **Knowledge Base**: What tribal knowledge was uncovered that should be documented?

### 4. Process & Efficiency

**Examine:**
- **Efficiency**: Where were time/tokens wasted? Could the solution have been reached in fewer steps?
- **Rabbit Holes**: Did the conversation diverge? Identify the specific message index where drift began.
- **Planning vs Execution**: Was the plan adequate? Should planning have been more thorough?
- **Scope Management**: Was the task scope maintained or did it creep?

### 5. Technical Retrospective & Alternatives

**Examine:**
- **Alternative Paths**: Knowing what we know now, was there a better library, pattern, or architectural approach?
- **Decision Points**: Were there key decisions where alternatives should have been discussed?
- **Automation**: Are there specific patterns in the work that suggest a need for automation (skill, script, MCP server)?

## Output Format

Organize your reflection starting with these three prioritized sections, followed by detailed analysis:

### 🛠️ Top 3: New Skills, Tools & Tooling
*The 3 most impactful ideas for new scripts, tools, MCP servers, or Cursor skills to build.*

1. **[Tool/Skill Name]**: [Specific description of what it would do and why it would help]
2. **[Tool/Skill Name]**: [Specific description of what it would do and why it would help]
3. **[Tool/Skill Name]**: [Specific description of what it would do and why it would help]

### 🚀 Top 3: Prompting & Context
*The 3 most critical pieces of advice for the user on how to ask better questions or provide better context.*

1. **[Prompting Pattern]**: [Specific advice with before/after examples if applicable]
2. **[Context Strategy]**: [Specific advice with before/after examples if applicable]
3. **[Steering Technique]**: [Specific advice with before/after examples if applicable]

### ✨ Top 3: Other Suggestions
*The 3 most significant other suggestions (process, documentation, agent behavior, etc.).*

1. **[Suggestion Category]**: [Specific recommendation and rationale]
2. **[Suggestion Category]**: [Specific recommendation and rationale]
3. **[Suggestion Category]**: [Specific recommendation and rationale]

---

### 🤖 Agent Course Correction
*Self-correction on what the agent should have done differently (reasoning, tooling, proactivity).*

- Identify specific moments where the agent:
  - Used the wrong tool or approach
  - Failed to ask clarifying questions when needed
  - Made incorrect assumptions
  - Could have been more proactive
  - Missed obvious solutions or patterns

### 📚 Documentation & Knowledge
*Specific recommendations for new or updated documentation. Identify context gaps.*

- Suggest new documentation files or updates to existing ones
- Identify tribal knowledge that should be captured
- Recommend additions to `.cursor/rules` or `CLAUDE.md`
- Note any external documentation (libraries, APIs) that would have helped

### 🔄 Workflow & Process
*Observations on efficiency, planning, and error recovery. Highlight any "rabbit holes" or divergence points.*

- Identify where the conversation was most/least efficient
- Note any planning gaps that caused rework
- Highlight divergence points and how to avoid them
- Suggest process improvements for similar tasks

### 💡 Technical Retrospective
*Alternative technical approaches or patterns that could have made the task easier.*

- Were there better libraries or tools available?
- Could a different architectural pattern have simplified things?
- Are there emerging best practices that should be adopted?
- What technical debt was created and how to address it?

### ✅ Next-Time Checklist
*A short bulleted checklist tailored to this specific type of task for future reference.*

For [describe task type] tasks:
- [ ] [Specific preparation step]
- [ ] [Context to provide upfront]
- [ ] [Tool or approach to prefer]
- [ ] [Common pitfall to avoid]
- [ ] [Validation step before completing]

## Guidelines

**Be Specific**: Avoid generic advice. Reference specific message numbers, file paths, or command sequences.

**Be Honest**: If the agent made mistakes, identify them clearly. If the user's prompts were unclear, explain why.

**Be Actionable**: Every suggestion should be concrete and implementable.

**Focus on Patterns**: Look for recurring issues or successful strategies that can inform future work.

**Consider Context**: Account for the user's expertise level, project complexity, and time constraints.

## Examples

See [`references/examples.md`](references/examples.md) for example retrospective output drawn from real sessions.
