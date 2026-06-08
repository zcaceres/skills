# Safe-command taxonomy

The Step 4 filter in `SKILL.md` summarises this; this file is the long form.

## Tier 1 — always safe to auto-allow

These are read-only and have no meaningful side effects beyond CPU/IO. They
don't write files, don't make network requests that change remote state, and
don't elevate privileges.

| Family       | Allowed prefixes                                                                                              |
|--------------|---------------------------------------------------------------------------------------------------------------|
| File listing | `ls`, `tree`, `pwd`, `realpath`, `readlink`, `stat`, `file`, `du -sh`, `df`                                   |
| File reading | `cat`, `head`, `tail`, `wc`, `xxd`, `strings`, `less`, `more` (the last two are interactive — usually skip)   |
| Search       | `grep`, `rg`, `ag`, `ack`, `find <path>` (no `-delete`/`-exec`/`-fprintf`)                                    |
| Git read     | `git status`, `git log`, `git diff`, `git show`, `git branch` (no `-d`/`-D`), `git remote -v`, `git blame`, `git rev-parse`, `git ls-files`, `git stash list`, `git config --get`, `git reflog` |
| GitHub read  | `gh pr view`, `gh pr list`, `gh pr diff`, `gh pr status`, `gh pr checks`, `gh issue view`, `gh issue list`, `gh repo view`, `gh release view`, `gh release list`, `gh api` (GET — default) |
| Versions     | `<tool> --version`, `<tool> -v`, `<tool> --help`, `<tool> -h`, `which`, `whereis`, `type`, `command -v`       |
| System info  | `whoami`, `hostname`, `uname`, `date`, `uptime`, `id`, `groups`                                               |
| Pkg read     | `npm ls`, `npm view`, `npm outdated`, `yarn list`, `pnpm list`, `bun pm ls`, `pip list`, `pip show`, `pip freeze`, `cargo metadata`, `cargo tree`, `go list`, `gem list`     |
| Container    | `docker ps`, `docker images`, `docker logs`, `docker inspect`, `docker version`, `docker info`                |
| Kubernetes   | `kubectl get`, `kubectl describe`, `kubectl logs`, `kubectl version`, `kubectl config view --minify`          |
| Network read | `curl <url>` (GET — default method only), `wget --spider`, `dig`, `nslookup`, `host`, `ping -c <n>`            |

## Tier 2 — flag for review (ask once, don't auto-propose)

Could leak data, could be slow, or could surprise a careful user. Show them
explicitly; default to off.

- `env`, `printenv` with no args — may dump secrets to the transcript.
- `cat .env*`, `cat *.pem`, `cat ~/.ssh/*` — secret material.
- `gh auth status` — leaks GitHub identity / token presence.
- `history`, reading shell history files.
- Reading absolute paths outside the current project (`cat /etc/...`,
  `ls /Users/<otheruser>/...`).
- `git log -p` on very large repos — slow but not dangerous.
- `find /` — slow; consider asking the user to narrow.

## Tier 3 — never propose

Mutating, privileged, or networked-with-effect. If a command falls in this
tier, skip it even if the user approved it 100 times.

### Filesystem mutations
`rm`, `rmdir`, `mv`, `cp` (to anywhere outside cwd), `mkdir`, `touch`,
`chmod`, `chown`, `chgrp`, `ln`, `dd`, `mkfs`, `shred`, `unlink`,
`truncate`, `install`.

### Privilege
`sudo`, `su`, `doas`, `pkexec`.

### Process control
`kill`, `killall`, `pkill`, `xargs kill`, `systemctl`, `launchctl`,
`service`, `nohup`, `disown`.

### Network mutations
`curl -X POST|PUT|PATCH|DELETE`, `curl --data*`, `curl -d`, `curl -F`,
`wget -O`, `scp`, `rsync` (writes), `ssh <host> <cmd>` (executes remote),
`nc -l`, `nmap`.

### Git writes
`git push`, `git reset --hard`, `git reset` (mode-changing), `git commit`,
`git rebase`, `git merge`, `git checkout <path>`, `git checkout -B`,
`git clean -f*`, `git tag`, `git stash drop`, `git filter-branch`,
`git update-ref`, `git config` (non-`--get`).

### GitHub writes
`gh pr merge`, `gh pr close`, `gh pr edit`, `gh pr review`, `gh pr ready`,
`gh issue close`, `gh issue edit`, `gh release create`, `gh release edit`,
`gh secret set`, `gh repo edit`, `gh api -X POST|PUT|PATCH|DELETE`.

### Package mutations
`npm install`, `npm uninstall`, `npm publish`, `npm update`, `yarn add`,
`yarn remove`, `pnpm add`, `pnpm remove`, `bun add`, `bun remove`,
`pip install`, `pip uninstall`, `brew install`, `brew uninstall`,
`brew upgrade`, `apt`, `apt-get`, `yum`, `dnf`, `cargo install`, `gem install`.

### Shell redirections / writes
Any `>`, `>>`, `| tee`, `| tee -a`, heredoc targeting a file
(`cat <<EOF > file`), process substitution writing to file.

### Compound disqualifiers
A command containing **any** of these breaks safety:
- `&&`, `||`, `;` separators where the right-hand side is mutating.
- `|` piped into a mutating command.
- Command substitution `$(…)` / backticks containing a mutating command.
- Backgrounded commands (`&` at the end).

When parsing, split on these separators and re-check every segment. If
any segment is Tier 3, the whole compound is Tier 3.

## Decision rule

```
for each candidate command:
  if matches Tier 3 pattern (or contains a Tier 3 sub-command):
    drop
  elif matches Tier 2 pattern:
    mark "flag for review"
  elif matches Tier 1 pattern:
    mark "safe to propose"
  else:
    drop  # unknown → unsafe
```

The fallback to "drop" on unknown is intentional. New tools appear constantly;
default-deny keeps the skill safe as the world changes.
