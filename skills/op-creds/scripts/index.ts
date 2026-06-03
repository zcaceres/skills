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

// Process substitutions of the form `<( op read|inject ... )` are masked
// only when the body is *safe* — i.e., it's just an `op read/inject`
// invocation with no extra shell wiring that could route the secret out
// of the kernel pipe to disk, another process, or the agent's stdout.
//
// Unsafe bodies (redirects, pipes, command chaining, command substitution,
// or op's own file-output flags) are left intact, so the bare `op read` /
// `op inject` inside them is caught by the regular danger scan.
const PROC_SUB_RE = /<\(([^()]*)\)/g;

function isSafeProcsubBody(body: string): boolean {
  if (!/^\s*op\s+(?:read|inject)\b/.test(body)) return false;
  // Shell metacharacters that could redirect, pipe, or chain commands.
  if (/[<>|;&`]/.test(body)) return false;
  if (/\$\(/.test(body)) return false;
  // op's own write-to-file flags.
  if (/(?:^|\s)-o(?:\s|=|$)/.test(body)) return false;
  if (/(?:^|\s)--out-file(?:\s|=|$)/.test(body)) return false;
  if (/(?:^|\s)--output(?:\s|=|$)/.test(body)) return false;
  return true;
}

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
    re: /\b(?:sh|bash|zsh|dash|ksh|fish)\s+-[a-zA-Z]*c\s+[^|;&]*\bop\s+read\b/,
    name: "op read (in subshell -c arg)",
    reason:
      "`op read` hidden inside a subshell `-c` arg would still write secrets to stdout.",
  },
  {
    re: /\b(?:sh|bash|zsh|dash|ksh|fish)\s+-[a-zA-Z]*c\s+[^|;&]*\bop\s+inject\b/,
    name: "op inject (in subshell -c arg)",
    reason:
      "`op inject` hidden inside a subshell `-c` arg would still write resolved secrets out.",
  },
  {
    re: /\b(?:sh|bash|zsh|dash|ksh|fish)\s+-[a-zA-Z]*c\s+[^|;&]*\bop\s+item\s+get\b[^|;&]*--reveal\b/,
    name: "op item get --reveal (in subshell -c arg)",
    reason: "`--reveal` hidden inside a subshell `-c` arg still prints secrets.",
  },
  {
    re: /\b(?:sh|bash|zsh|dash|ksh|fish)\s+-[a-zA-Z]*c\s+[^|;&]*\bop\s+item\s+get\b[^|;&]*--format(?:=|\s+)json\b/,
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

// Heuristic quote handling: a quoted region that holds a single shell-style
// token (no whitespace) is treated as an argv quoting flourish and unquoted
// to its body, so `op item get foo "--reveal"` and `op read "op://..."`
// still surface their dangerous flags. A quoted region containing whitespace
// is treated as prose (echo strings, commit messages, grep patterns) and
// erased, so legitimate documentation mentions of `op read` don't trip the
// danger scan.
function stripQuotes(text: string): string {
  let out = text.replace(/"((?:[^"\\]|\\.)*)"/g, (_, body) =>
    /\s/.test(body) ? '""' : body
  );
  out = out.replace(/'([^']*)'/g, (_, body) =>
    /\s/.test(body) ? "''" : body
  );
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

  // 2. Strip quoted prose so documentation-style mentions don't false-trigger,
  //    while keeping single-token quoted args (so `"--reveal"` and quoted
  //    `op://...` refs still get seen by the scan).
  let scanned = stripQuotes(command);

  // 3. Mask SAFE process substitutions — `<(op read|inject ...)` with no
  //    redirects, pipes, command chaining, or op-side file-output flags.
  //    Unsafe procsub bodies are left intact so the bare `op read/inject`
  //    inside them is caught by the next scan.
  scanned = scanned.replace(PROC_SUB_RE, (m, body) =>
    isSafeProcsubBody(body) ? "<()" : m
  );

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
  } catch (err) {
    // Fail-open so a misbehaving hook doesn't break the user's tool call,
    // but surface the error so silent disablement is observable. Matches
    // dont-read-dot-env's posture, with louder reporting.
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error(`op-creds: hook error (failing open, NOT screening this call): ${msg}`);
    process.exit(0);
  }
}

main();
