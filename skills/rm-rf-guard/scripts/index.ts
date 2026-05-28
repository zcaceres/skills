#!/usr/bin/env bun
/**
 * Block destructive file deletion commands and suggest using trash instead.
 * This is a Claude Code hook that runs on PreToolUse for Bash commands.
 */

interface ToolInput {
  tool_input?: {
    command?: string;
  };
}

/**
 * Remove quoted strings to avoid false positives on commands like echo 'rm test'.
 */
function stripQuotes(command: string): string {
  // Remove double-quoted strings (handles escapes)
  let stripped = command.replace(/"(?:[^"\\]|\\.)*"/g, '""');
  // Remove single-quoted strings (no escapes in single quotes)
  stripped = stripped.replace(/'[^']*'/g, "''");
  return stripped;
}

/**
 * Check if command contains actual destructive commands (not in quotes).
 */
function containsDestructiveCommand(command: string): boolean {
  const stripped = stripQuotes(command);

  // Check for safe patterns first (git rm is fine)
  if (/\bgit\s+rm\b/.test(stripped)) {
    return false;
  }

  // Subshell patterns need to check the ORIGINAL command since
  // the dangerous command is intentionally inside quotes
  const subshellPatterns = [
    /\b(?:sh|bash|zsh|dash)\s+-c\s+.*\brm\b/,
    /\b(?:sh|bash|zsh|dash)\s+-c\s+.*\bshred\b/,
    /\b(?:sh|bash|zsh|dash)\s+-c\s+.*\bunlink\b/,
    /\b(?:sh|bash|zsh|dash)\s+-c\s+.*\bfind\b.*-delete\b/,
  ];

  if (subshellPatterns.some((pattern) => pattern.test(command))) {
    return true;
  }

  // Patterns that indicate rm/shred/unlink being used as actual commands:
  // - At start of command
  // - After shell operators: &&, ||, ;, |, $(, `
  // - After sudo, xargs, command, env
  // - With absolute/relative paths like /bin/rm, /usr/bin/rm, ./rm
  const destructivePatterns = [
    // Basic commands at start or after operators
    /(?:^|&&|\|\||;|\||\$\(|`)\s*rm\b/,
    /(?:^|&&|\|\||;|\||\$\(|`)\s*shred\b/,
    /(?:^|&&|\|\||;|\||\$\(|`)\s*unlink\b/,

    // Absolute/relative paths to rm
    /(?:^|&&|\|\||;|\||\$\(|`)\s*\/.*\/rm\b/,
    /(?:^|&&|\|\||;|\||\$\(|`)\s*\.\/rm\b/,

    // Via sudo, xargs, command, env
    /\bsudo\s+rm\b/,
    /\bsudo\s+\/.*\/rm\b/,
    /\bxargs\s+rm\b/,
    /\bxargs\s+\/.*\/rm\b/,
    /\bcommand\s+rm\b/,
    /\benv\s+rm\b/,

    // Backslash escape to bypass aliases
    /(?:^|&&|\|\||;|\||\$\(|`)\s*\\rm\b/,

    // find with -delete or -exec rm
    /\bfind\b.*\s-delete\b/,
    /\bfind\b.*-exec\s+rm\b/,
    /\bfind\b.*-exec\s+\/.*\/rm\b/,
  ];

  return destructivePatterns.some((pattern) => pattern.test(stripped));
}

async function main(): Promise<void> {
  try {
    const input = await Bun.stdin.text();
    const data: ToolInput = JSON.parse(input);
    const command = data.tool_input?.command ?? "";

    if (!command) {
      process.exit(0);
    }

    if (containsDestructiveCommand(command)) {
      console.error(
        "BLOCKED: Do not use destructive file deletion commands " +
          "(rm, shred, unlink). Use the 'trash' CLI instead:\n" +
          "  - trash file.txt\n" +
          "  - trash directory/\n\n" +
          "If trash is not installed:\n" +
          "  - macOS: brew install trash\n" +
          "  - Linux/npm: npm install -g trash-cli"
      );
      process.exit(2);
    }

    process.exit(0);
  } catch {
    // Parse errors allow through (match Python behavior)
    process.exit(0);
  }
}

main();
