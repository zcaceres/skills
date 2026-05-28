#!/usr/bin/env bun
/**
 * Block destructive git commands (reset --hard, force push, clean -f, etc.).
 * Claude Code PreToolUse hook for the Bash tool.
 */

interface ToolInput {
  tool_input?: {
    command?: string;
  };
}

// Strip quoted text so `echo 'git reset --hard'` is allowed — but keep
// quoted runs that look like a flag (`'--hard'`, `"-fdx"`), since bash strips
// the quotes at exec and those tokens reach git as real arguments.
function stripQuotes(command: string): string {
  let stripped = command.replace(/"((?:[^"\\]|\\.)*)"/g, (_, inner) =>
    /^-/.test(inner) ? inner : '""'
  );
  stripped = stripped.replace(/'([^']*)'/g, (_, inner) =>
    /^-/.test(inner) ? inner : "''"
  );
  return stripped;
}

// Matches a git invocation: bare `git`, `\git`, `/usr/bin/git`, `./git`,
// or wrapped via sudo/command/env/xargs. Anchored to start-of-command or
// after a shell operator so `mygit` and `... echo git ...` don't match.
// Quotes are intentionally NOT separators here: `echo "foo" git reset --hard`
// is one echo invocation, not a git invocation. Subshell bodies are handled
// separately by extracting the quoted body and re-running the rules.
const OP = String.raw`(?:^|&&|\|\||;|\||\$\(|` + "`" + String.raw`|\n|\r)`;
const GIT_PATH = String.raw`(?:\\)?(?:/[\w./-]+/)?(?:\.\/)?git\b`;
// Options between a wrapper and `git`: sudo flags (`-n`, `-E`, `-u user`),
// env assignments (`FOO=bar`), and long flags. Value-taking short opts
// (`-u`, `-g`) are listed explicitly so a bare `-n` doesn't swallow `git`.
const WRAPPER_OPTS = String.raw`(?:\s+(?:-[ug]\s+\S+|[A-Z_][\w]*=\S*|--[\w-]+(?:=\S+)?|-[A-Za-z]+))*`;
const GIT = `(?:${OP}\\s*${GIT_PATH}|\\b(?:sudo|command|env|xargs)${WRAPPER_OPTS}\\s+(?:/[\\w./-]+/)?git\\b)`;
// Optional run of git's global options between `git` and the subcommand.
// Value-taking opts (`-C`, `-c`, `--git-dir`, `--work-tree`, `--namespace`,
// `--exec-path`, `--super-prefix`, `--list-cmds`) are listed explicitly so
// they consume their value; bare flags like `-P` or `--no-pager` don't
// greedily swallow the next token (which would hide `clean`/`push`/etc.).
const LONG_VALUE_OPTS = String.raw`--(?:git-dir|work-tree|namespace|exec-path|super-prefix|list-cmds)`;
const GIT_OPTS =
  String.raw`(?:\s+(?:` +
  String.raw`-[Cc]\s+\S+` +
  String.raw`|${LONG_VALUE_OPTS}(?:[= ]\S+)?` +
  String.raw`|-[A-Za-z]` +
  String.raw`|--[\w-]+(?:=\S+)?` +
  String.raw`))*`;
// Segment boundary: any shell separator (now also newlines).
const SEG = String.raw`[^&;|\n\r]`;

// Each rule: a label (used in the error message) and a regex matching a
// destructive subcommand invocation. `[^&;|]*` keeps matches on a single
// shell segment so `git status; git reset --hard` triggers the second part.
const RULES: { label: string; pattern: RegExp }[] = [
  {
    label: "git reset --hard",
    pattern: new RegExp(`${GIT}${GIT_OPTS}\\s+reset\\b${SEG}*--hard\\b`),
  },
  {
    label: "git push --force / -f",
    pattern: new RegExp(
      `${GIT}${GIT_OPTS}\\s+push\\b${SEG}*(?:--force\\b(?!-with-lease)|\\s-f\\b)`
    ),
  },
  {
    label: "git clean -f",
    pattern: new RegExp(
      `${GIT}${GIT_OPTS}\\s+clean\\b${SEG}*(?:\\s-[a-zA-Z]*f[a-zA-Z]*\\b|--force\\b)`
    ),
  },
  {
    label: "git checkout <path> (worktree discard)",
    pattern: new RegExp(
      `${GIT}${GIT_OPTS}\\s+checkout\\s+(?:\\.(?:\\s|$)|--\\s)`
    ),
  },
  {
    label: "git branch -D / --delete --force",
    pattern: new RegExp(
      `${GIT}${GIT_OPTS}\\s+branch\\b${SEG}*(?:\\s-D\\b|(?:--delete|\\s-d)\\s+(?:${SEG}*\\s)?--force\\b|--force\\s+(?:${SEG}*\\s)?(?:--delete|-d)\\b)`
    ),
  },
  {
    label: "git stash drop/clear",
    pattern: new RegExp(`${GIT}${GIT_OPTS}\\s+stash\\s+(?:drop|clear)\\b`),
  },
  {
    label: "git worktree remove --force",
    pattern: new RegExp(
      `${GIT}${GIT_OPTS}\\s+worktree\\s+remove\\b${SEG}*(?:--force\\b|\\s-f\\b)`
    ),
  },
];

// Capture the body of a `(sh|bash|zsh|dash) [opts] -c '…'`/"…" invocation.
// Allows preceding short/long shell flags so `bash -lc`, `bash -l -c`,
// `bash --login -c`, `zsh -ic` all match. The `-c` itself can be the tail
// of a short flag cluster (`-lc`, `-ic`, `-Ec`).
const SUBSHELL =
  /\b(?:sh|bash|zsh|dash)(?:\s+--?[\w-]+)*\s+-[a-zA-Z]*c\s+(['"])([\s\S]*?)\1/g;

function findDestructiveGit(command: string): string | null {
  const stripped = stripQuotes(command);
  for (const { label, pattern } of RULES) {
    if (pattern.test(stripped)) return label;
  }
  // For `bash -c '…'` the dangerous part lives inside quotes that
  // stripQuotes erased. Re-extract each subshell body and check it directly.
  for (const m of command.matchAll(SUBSHELL)) {
    const inner = m[2];
    for (const { label, pattern } of RULES) {
      if (pattern.test(inner)) return label;
    }
  }
  return null;
}

async function main(): Promise<void> {
  try {
    const input = await Bun.stdin.text();
    const data: ToolInput = JSON.parse(input);
    const command = data.tool_input?.command ?? "";

    if (!command) {
      process.exit(0);
    }

    const hit = findDestructiveGit(command);
    if (hit) {
      console.error(
        `BLOCKED: detected destructive git command (${hit}).\n\n` +
          "Safer alternatives:\n" +
          "  - reset --hard      → git stash, or git reset --soft / --mixed\n" +
          "  - push --force      → git push --force-with-lease\n" +
          "  - clean -f          → trash <path> (preserves recovery)\n" +
          "  - checkout <path>   → git restore --source=HEAD --staged <path> after review\n" +
          "  - branch -D         → git branch -d (refuses if unmerged)\n" +
          "  - stash drop/clear  → leave stashes; prune intentionally\n" +
          "  - worktree remove -f → resolve dirty state first, then remove without -f\n\n" +
          "If you genuinely need this, ask the user to run it themselves."
      );
      process.exit(2);
    }

    process.exit(0);
  } catch {
    process.exit(0);
  }
}

main();
