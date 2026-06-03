#!/usr/bin/env bun
/**
 * Block Bash tool calls that would leak 1Password secrets into the
 * agent's context. PreToolUse hook for Claude Code.
 *
 * Blocked patterns (representative examples):
 *   op read "op://Vault/Item/field"            — prints to stdout
 *   op read "op://..." > /tmp/x                — leaks to disk
 *   VAR=$(op read "op://...")                  — captures into shell, easy to echo
 *   op inject -i template                      — resolves refs to stdout/file
 *   op item get foo --reveal                   — explicitly reveals secret fields
 *   op item get foo --format=json              — JSON output includes secret values
 *   bash -c 'op read "op://..."'               — subshell bypass
 *
 * Allowed patterns:
 *   ssh -i <(op read "op://...") user@host     — secret flows through /dev/fd/N
 *   op run --env-file=template -- cmd          — `op run` masks output
 *   op signin / op whoami / op vault list      — no secret content in output
 *   with-creds --env FOO=op://... -- cmd       — bundled wrapper handles it safely
 */

interface ToolInput {
  tool_name?: string;
  tool_input?: {
    command?: string;
  };
}

// Safe wrapper: `<(op read ...)` or `<(op inject ...)`. The secret flows
// through the file-descriptor pipe to the consumer; it never reaches the
// agent's tool output.
const SAFE_PROC_SUB_RE = /<\(\s*op\s+(?:read|inject)\b[^()]*\)/g;

interface DangerPattern {
  re: RegExp;
  name: string;
  reason: string;
}

const DANGER_PATTERNS: DangerPattern[] = [
  {
    re: /\bop\s+read\b/,
    name: "op read",
    reason:
      "`op read` writes the secret to stdout, which lands in the agent's tool output.",
  },
  {
    re: /\bop\s+inject\b/,
    name: "op inject",
    reason:
      "`op inject` writes the resolved template (with secrets substituted) to stdout or to a file.",
  },
  {
    re: /\bop\s+item\s+get\b[^|;&]*--reveal\b/,
    name: "op item get --reveal",
    reason: "`--reveal` explicitly prints secret fields to stdout.",
  },
  {
    re: /\bop\s+item\s+get\b[^|;&]*--format(?:=|\s+)json\b/,
    name: "op item get --format json",
    reason:
      "`--format json` includes secret values inline in the JSON output.",
  },
];

// Patterns checked against the ORIGINAL command (before quote stripping)
// so a subshell/eval that hides the dangerous op call inside a quoted
// arg is still caught. Mirrors the technique used by dont-read-dot-env.
const RAW_BYPASS_PATTERNS: DangerPattern[] = [
  {
    re: /\b(?:sh|bash|zsh|dash|ksh|fish)\s+-c\s+[^|;&]*\bop\s+read\b/,
    name: "op read (in subshell -c arg)",
    reason:
      "`op read` hidden inside a subshell `-c` arg would still write secrets to stdout.",
  },
  {
    re: /\b(?:sh|bash|zsh|dash|ksh|fish)\s+-c\s+[^|;&]*\bop\s+inject\b/,
    name: "op inject (in subshell -c arg)",
    reason:
      "`op inject` hidden inside a subshell `-c` arg would still write resolved secrets out.",
  },
  {
    re: /\b(?:sh|bash|zsh|dash|ksh|fish)\s+-c\s+[^|;&]*\bop\s+item\s+get\b[^|;&]*--reveal\b/,
    name: "op item get --reveal (in subshell -c arg)",
    reason: "`--reveal` hidden inside a subshell `-c` arg still prints secrets.",
  },
  {
    re: /\b(?:sh|bash|zsh|dash|ksh|fish)\s+-c\s+[^|;&]*\bop\s+item\s+get\b[^|;&]*--format(?:=|\s+)json\b/,
    name: "op item get --format json (in subshell -c arg)",
    reason: "`--format json` hidden inside a subshell `-c` arg still prints secrets.",
  },
  {
    re: /\beval\s+[^|;&]*\bop\s+read\b/,
    name: "op read (in eval arg)",
    reason: "`op read` hidden inside `eval` would still write secrets to stdout.",
  },
  {
    re: /\beval\s+[^|;&]*\bop\s+inject\b/,
    name: "op inject (in eval arg)",
    reason: "`op inject` hidden inside `eval` would still write resolved secrets out.",
  },
];

function stripQuotes(text: string): string {
  let out = text.replace(/"(?:[^"\\]|\\.)*"/g, '""');
  out = out.replace(/'[^']*'/g, "''");
  return out;
}

function findRawBypass(command: string): DangerPattern | null {
  for (const p of RAW_BYPASS_PATTERNS) {
    if (p.re.test(command)) return p;
  }
  return null;
}

function findDanger(text: string): DangerPattern | null {
  for (const p of DANGER_PATTERNS) {
    if (p.re.test(text)) return p;
  }
  return null;
}

function findBlockedInBashCommand(command: string): DangerPattern | null {
  // 1. Subshell/eval bypass scan on the raw text — catches things hidden
  //    inside quoted args that the strip step would otherwise erase.
  const rawHit = findRawBypass(command);
  if (rawHit) return rawHit;

  // 2. Strip quoted substrings so legitimate mentions in echo strings,
  //    commit messages, grep patterns, etc. don't trip the scan.
  let scanned = stripQuotes(command);

  // 3. Mask SAFE process substitutions — `<(op read ...)` and
  //    `<(op inject ...)` deliver secrets through a kernel pipe, not stdout,
  //    so they're the sanctioned consumption pattern.
  scanned = scanned.replace(SAFE_PROC_SUB_RE, "<()");

  // 4. Anything left that matches a danger pattern is a real leak.
  return findDanger(scanned);
}

async function main(): Promise<void> {
  try {
    const raw = await Bun.stdin.text();
    if (!raw.trim()) {
      process.exit(0);
    }
    const data: ToolInput = JSON.parse(raw);
    if (data.tool_name !== "Bash") {
      process.exit(0);
    }
    const cmd = data.tool_input?.command ?? "";
    if (!cmd) {
      process.exit(0);
    }
    const hit = findBlockedInBashCommand(cmd);
    if (hit) {
      console.error(
        `BLOCKED: ${hit.name}\n` +
          `Reason: ${hit.reason}\n` +
          `Command: ${cmd}\n\n` +
          "Safe alternatives:\n" +
          "  • Wrap in process substitution so the secret flows through a /dev/fd/N pipe:\n" +
          "      cmd --key-file <(op read \"op://Vault/Item/field\")\n" +
          "  • Use the bundled `with-creds` wrapper:\n" +
          "      with-creds --env API_KEY=op://Vault/Item/field -- cmd\n" +
          "      with-creds --fd  KEY=op://Vault/Item/field -- cmd --key %KEY%\n" +
          "  • Use `op run` for env-var consumers (it masks secret values in child output):\n" +
          "      op run --env-file=template -- cmd"
      );
      process.exit(2);
    }
    process.exit(0);
  } catch {
    // Don't crash the user's tool call if the hook itself misbehaves;
    // dont-read-dot-env adopts the same fail-open posture for parser errors.
    process.exit(0);
  }
}

main();
