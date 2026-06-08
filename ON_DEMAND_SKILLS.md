# On-Demand Skill Pattern (Token-Saving Workflows in Gemini CLI)

This document describes a powerful pattern for using **Agent Skills** in a token-efficient manner. 

By default, Gemini CLI registers and exposes all enabled skills to the model, consuming precious tokens in the system prompt on every turn of a conversation—even when those skills are completely unused.

By combining **Disabled Skills** and **Custom TOML Commands**, we can achieve **zero-cost standby** for all skills while keeping them fully accessible via direct slash-command invocations (e.g., `/review-code`).

---

## The Problem: Automatic Token Bloat

In standard configurations, every active skill in `~/.gemini/skills/` is registered with the CLI. This injects metadata into the system prompt so the model can auto-discover and trigger them.
* While progressive disclosure limits loading the entire `SKILL.md` body initially, the cumulative metadata overhead for dozens of skills still adds up.
* More importantly, the model might accidentally auto-trigger or load skills when they are not strictly needed, ballooning your context window and increasing response latency/billing.

---

## The Solution: The On-Demand Skill Pattern

We can configure Gemini CLI to completely disable background/automatic skill discovery, and instead map each skill to an explicit **Custom TOML Command** that loads the skill's `SKILL.md` file **on-demand only**.

### Step 1: Disable Automatic Skill Scanning globally

Add the `"skills": { "enabled": false }` configuration block to your global settings file:

**File:** `~/.gemini/settings.json`
```json
{
  "skills": {
    "enabled": false
  }
}
```

This prevents the CLI from scanning skills or injecting any skill metadata/hooks into the standard conversational system prompt.

---

### Step 2: Define Custom TOML Commands for Your Skills

For every skill you want to access, create a corresponding custom command TOML file inside your commands directory. 

**Folder:** `~/.gemini/commands/`

For example, to map the `review-code` skill, create `review-code.toml`:

**File:** `~/.gemini/commands/review-code.toml`
```toml
description = "Review the current branch diff and report bugs as structured inline-style findings."

prompt = """
Please act with the expertise of the 'review-code' skill.

Follow the instructions in the skill's SKILL.md:
@{~/.gemini/skills/review-code/SKILL.md}

Arguments/inputs to the command:
{{args}}
"""
```

### Step 3: Trigger On-Demand with File Injection

The key to this pattern is the **File-Injection Directive** (`@{path/to/file}`):
* When you type `/review-code <args>`, the CLI resolves the custom command.
* `@{~/.gemini/skills/review-code/SKILL.md}` dynamically reads and injects the raw instruction markdown of the skill directly into that single prompt.
* After the command run finishes, the conversation context remains clean—no unnecessary instructions persist in background turns.

---

## Key Benefits

1. **Zero-Cost Standby**: If you do not use a skill in a session, it consumes **exactly 0 tokens**.
2. **Deterministic Execution**: Prevents the model from hallucinating or auto-triggering complex workflows when you just want a standard chat conversation.
3. **Seamless UX**: From the user's perspective, nothing changes! You can still type `/review-code`, `/stacked-pr`, or `/gh-project-next` and get the exact same behavior as before.
4. **Complete Independence**: File injection is a pure CLI-level template feature—it works perfectly even when the central `skills.enabled` setting is turned off.
