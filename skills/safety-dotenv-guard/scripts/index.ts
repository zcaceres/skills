#!/usr/bin/env bun
/**
 * Block tool calls that read .env files so secrets never enter the agent's
 * context. PreToolUse hook for Claude Code, dispatched per tool.
 */

interface ToolInput {
  tool_name?: string;
  tool_input?: {
    file_path?: string;
    command?: string;
    pattern?: string;
    path?: string;
    glob?: string;
  };
}

const TEMPLATE_ALLOWLIST = new Set([
  ".env.example",
  ".env.sample",
  ".env.template",
  ".env.dist",
]);

const ENV_NAME_RE = /^\.env(?:\.[A-Za-z0-9_-]+)*$/;

function basename(p: string): string {
  const trimmed = p.replace(/[\\/]+$/, "");
  const i = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  return i >= 0 ? trimmed.slice(i + 1) : trimmed;
}

function isBlockedEnvName(name: string): boolean {
  if (!ENV_NAME_RE.test(name)) return false;
  if (TEMPLATE_ALLOWLIST.has(name)) return false;
  return true;
}

function stripQuotes(text: string): string {
  let out = text.replace(/"(?:[^"\\]|\\.)*"/g, '""');
  out = out.replace(/'[^']*'/g, "''");
  return out;
}

const ENV_TOKEN_RE = /(?<![A-Za-z0-9_.\-])\.env(?:\.[A-Za-z0-9_-]+)*(?![A-Za-z0-9_.\-])/g;

function findBlockedEnvName(text: string): string | null {
  ENV_TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ENV_TOKEN_RE.exec(text)) !== null) {
    const name = match[0];
    if (isBlockedEnvName(name)) return name;
  }
  return null;
}

// Wildcard patterns that could glob-expand to match a real .env file.
// Each entry maps to the synthetic "name" we report when blocking.
const ENV_WILDCARD_PATTERNS: Array<{ re: RegExp; name: string }> = [
  // .e* .en* .env* .env? .env[…] .env.?* .env.*  — any glob starting with .e
  { re: /(?<![A-Za-z0-9_.\-])\.e[A-Za-z0-9_.\-]*[*?\[][A-Za-z0-9_.\-*?\[\]]*/, name: ".e* (glob)" },
  // .??v .?nv — short 3-char dotfile globs that can match .env
  { re: /(?<![A-Za-z0-9_.\-])\.[?*][?*A-Za-z0-9_\-]?v(?![A-Za-z0-9_.\-])/, name: ".??v (glob)" },
  // .??? — any 3-char dotfile glob (matches .env)
  { re: /(?<![A-Za-z0-9_.\-])\.\?\?\?(?![A-Za-z0-9_.\-])/, name: ".??? (glob)" },
];

function findBlockedWildcard(text: string): string | null {
  for (const { re, name } of ENV_WILDCARD_PATTERNS) {
    if (re.test(text)) return name;
  }
  return null;
}

// Patterns checked against the ORIGINAL Bash command (before quote stripping),
// so that bypasses hiding the .env reference inside quoted subshell/eval/find
// arguments are still caught.
const BASH_RAW_PATTERNS: Array<{ re: RegExp; name: string }> = [
  // sh|bash|zsh|dash|ksh|fish -c '… .env …'
  {
    re: /\b(?:sh|bash|zsh|dash|ksh|fish)\s+-c\s+[^|;&]*\.env(?:\.[A-Za-z0-9_-]+)*(?![A-Za-z0-9_.\-])/,
    name: ".env (in subshell -c arg)",
  },
  // eval '… .env …'
  {
    re: /\beval\s+[^|;&]*\.env(?:\.[A-Za-z0-9_-]+)*(?![A-Za-z0-9_.\-])/,
    name: ".env (in eval arg)",
  },
  // find … -name '.e…' — quoted find -name patterns targeting .e-prefixed names
  {
    re: /\bfind\b[^|;&]*\s-i?name\s+['"]?\.e/,
    name: ".e* (in find -name arg)",
  },
];

function findBlockedBashRawPattern(command: string): string | null {
  for (const { re, name } of BASH_RAW_PATTERNS) {
    if (re.test(command)) return name;
  }
  return null;
}

function findBlockedInBashCommand(command: string): string | null {
  // 1. Check raw command for quote-hiding bypasses (subshell -c, eval, find -name).
  const raw = findBlockedBashRawPattern(command);
  if (raw) return raw;

  // 2. Strip quoted substrings to suppress legit mentions in commit messages,
  //    grep patterns, echo strings, etc., then scan for tokens.
  const stripped = stripQuotes(command);
  const name = findBlockedEnvName(stripped);
  if (name) return name;
  const wildcard = findBlockedWildcard(stripped);
  if (wildcard) return wildcard;
  return null;
}

function findBlockedInPlainText(text: string): string | null {
  // For Grep/Glob path/pattern/glob fields — no shell quoting to strip.
  const name = findBlockedEnvName(text);
  if (name) return name;
  return findBlockedWildcard(text);
}

function inferToolName(input: ToolInput["tool_input"]): string | null {
  if (!input) return null;
  if (typeof input.command === "string") return "Bash";
  if (typeof input.file_path === "string") return "Read";
  if (typeof input.pattern === "string") return "Glob";
  if (typeof input.path === "string" || typeof input.glob === "string") return "Grep";
  return null;
}

function blockedReason(data: ToolInput): { name: string; where: string } | null {
  const toolName = data.tool_name ?? inferToolName(data.tool_input);
  const input = data.tool_input ?? {};

  switch (toolName) {
    case "Read": {
      const fp = input.file_path ?? "";
      if (!fp) return null;
      const name = basename(fp);
      return isBlockedEnvName(name) ? { name, where: `Read file_path "${fp}"` } : null;
    }
    case "Bash": {
      const cmd = input.command ?? "";
      if (!cmd) return null;
      const hit = findBlockedInBashCommand(cmd);
      return hit ? { name: hit, where: `Bash command "${cmd}"` } : null;
    }
    case "Grep": {
      for (const field of ["path", "glob"] as const) {
        const value = input[field];
        if (typeof value !== "string" || !value) continue;
        const hit = findBlockedInPlainText(value);
        if (hit) return { name: hit, where: `Grep ${field} "${value}"` };
      }
      return null;
    }
    case "Glob": {
      for (const field of ["pattern", "path"] as const) {
        const value = input[field];
        if (typeof value !== "string" || !value) continue;
        const hit = findBlockedInPlainText(value);
        if (hit) return { name: hit, where: `Glob ${field} "${value}"` };
      }
      return null;
    }
    default:
      return null;
  }
}

async function main(): Promise<void> {
  try {
    const raw = await Bun.stdin.text();
    if (!raw.trim()) {
      process.exit(0);
    }
    const data: ToolInput = JSON.parse(raw);
    const hit = blockedReason(data);
    if (hit) {
      console.error(
        `BLOCKED: Refusing to read .env file "${hit.name}" — it likely contains secrets.\n` +
          `Source: ${hit.where}\n\n` +
          "If you need a value from .env, ask the user to expose it via process env\n" +
          "(e.g. $DATABASE_URL) or a secrets manager. To learn the variable names,\n" +
          "read .env.example / .env.sample / .env.template / .env.dist instead — those\n" +
          "are allowed."
      );
      process.exit(2);
    }
    process.exit(0);
  } catch {
    process.exit(0);
  }
}

main();
