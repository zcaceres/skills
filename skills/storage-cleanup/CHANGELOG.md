# @zcaceres/skill-storage-cleanup

## 1.0.0

### Major Changes

- Initial release: Claude Code skill for finding large files and
  directories safe to delete to reclaim disk space. Walks seven categories
  in safety order: package-manager caches → stale node_modules → local AI
  models (Ollama, LM Studio, Hugging Face, GPT4All, llama.cpp) → Docker
  artifacts → application caches (Xcode, Gradle, Spotify, Chrome, VS
  Code) → large files in Downloads/Desktop → system logs and caches.
  **Conservative by design** — never auto-deletes; always shows
  last-modified dates and groups findings by risk level (Safe / Probably
  Safe / Use Caution).

  Ported from the user's local `~/.claude/skills/storage-cleanup/` into
  this monorepo. Body preserved verbatim.
