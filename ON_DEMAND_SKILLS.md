# On-Demand Skill Pattern (Token-Saving Workflows in Gemini CLI)

This document describes a pattern for using **Agent Skills** in a token-efficient manner, alongside a critical system constraint identified during implementation.

By default, Gemini CLI registers and exposes all enabled skills to the model, consuming precious tokens in the system prompt on every turn of a conversation—even when those skills are completely unused.

The **On-Demand Skill Pattern** was conceived to achieve **zero-cost standby** for all skills by disabling background/automatic skill scanning globally and mapping each skill to an explicit **Custom TOML Command** that loads the skill's `SKILL.md` file on-demand only.

---

## 🛑 Critical System Constraint: Workspace Sandboxing

During real-world usage of this pattern, we discovered a major security constraint in Gemini CLI's file-injection mechanism:

> **File-injection directives (`@{path}`) are strictly sandboxed to the active workspace directory.**

If you attempt to load a file from outside the current workspace (such as your global `~/.gemini/skills/` directory) via a custom command, the CLI will block the access and fail with the following error:

```
✕ Failed to inject content for '@{~/.gemini/skills/review-code/SKILL.md}': Path not found in workspace:
  ~/.gemini/skills/review-code/SKILL.md
```

### Why this happens:
To maintain security and prevent malicious prompts or scripts from reading sensitive user files, Gemini CLI restricts all file-reading directives to files residing within the allowed project workspace directories. 

### Conclusion:
Because of this sandboxing constraint, **the On-Demand Skill Pattern cannot be used for global/machine-level skills when working across arbitrary repositories.** 

For global, machine-wide skills, **you must rely on standard, native skill loading** rather than custom TOML command wrappers.

---

## The Original Concept (For Workspace-Local Reference)

If you are implementing this pattern for **workspace-local** skills (where the skill directory is checked into the repository and resides fully within the active workspace), the pattern is still fully valid.

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
3. **Seamless UX**: From the user's perspective, nothing changes! You can still type `/review-code`, `/pr`, or `/gh-project next` and get the exact same behavior as before.
4. **Complete Independence**: File injection is a pure CLI-level template feature—it works perfectly even when the central `skills.enabled` setting is turned off.
