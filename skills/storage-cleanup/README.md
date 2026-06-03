# storage-cleanup

Claude Code skill for finding large files and directories that are safe
to delete to reclaim disk space. Walks seven categories in safety order:
package-manager caches → stale node_modules → local AI models → Docker
artifacts → application caches → large files in Downloads/Desktop →
system logs and caches. **Conservative by design** — never
auto-deletes; always shows last-modified dates and groups findings by
risk level (Safe / Probably Safe / Use Caution).

See [SKILL.md](./SKILL.md) for the scan workflow, the cleanup commands
per category, the common-space-hogs reference table, and an example
session.

## Install

```sh
npx skills add zcaceres/skills -s storage-cleanup
```

Pure-markdown skill — no binaries.

## Origin

Ported from the user's local `~/.claude/skills/storage-cleanup/` into
this monorepo. Body preserved verbatim.
