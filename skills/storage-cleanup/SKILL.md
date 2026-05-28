---
name: storage-cleanup
description: Find large files and directories safe to delete: inactive node_modules, local AI models, Docker artifacts, package caches, old downloads. Use on "free up space", "disk space".
---

# Storage Cleanup - Find Large, Safely-Deletable Files

This skill helps you reclaim disk space by finding large files and directories that are likely safe to delete. It prioritizes things you probably don't use daily: stale node_modules, cached AI models, old Docker images, and overgrown caches.

## When to Use This Skill

Use this skill when the user requests:
- "Free up space on my computer"
- "Find large files I can delete"
- "What's taking up all my disk space?"
- "Storage cleanup"
- "Clean up storage"
- "Find old node_modules"
- "Clear caches"

## Safety Philosophy

This skill is designed to be **conservative and safe**:
- Never auto-delete anything
- Always show last accessed/modified dates
- Prioritize files that are regenerable (caches, node_modules)
- Warn about anything potentially important
- Group by risk level (safe → caution → risky)

## Workflow Steps

### 1. Check Current Disk Usage

Start by showing overall disk status:

```bash
df -h /
```

Also show the user's home directory size:
```bash
du -sh ~
```

### 2. Scan for Large Files by Category

Scan these categories in order (most likely to be safe first):

#### Category A: Package Manager Caches (Very Safe)

These are fully regenerable - just re-download on next install.

```bash
# npm cache
du -sh ~/.npm 2>/dev/null

# yarn cache
du -sh ~/Library/Caches/Yarn 2>/dev/null
du -sh ~/.yarn/cache 2>/dev/null

# pnpm cache
du -sh ~/Library/pnpm 2>/dev/null

# pip cache
du -sh ~/Library/Caches/pip 2>/dev/null

# Homebrew cache
du -sh ~/Library/Caches/Homebrew 2>/dev/null

# CocoaPods cache
du -sh ~/Library/Caches/CocoaPods 2>/dev/null
```

#### Category B: node_modules in Inactive Projects (Safe)

Find node_modules folders, sorted by size, with last modified date:

```bash
# Find all node_modules, show size and last modified
find ~ -name "node_modules" -type d -prune 2>/dev/null | while read dir; do
  mod_date=$(stat -f "%Sm" -t "%Y-%m-%d" "$dir" 2>/dev/null)
  size=$(du -sh "$dir" 2>/dev/null | cut -f1)
  echo "$size|$mod_date|$dir"
done | sort -hr | head -20
```

**Decision criteria for node_modules:**
- Last modified > 30 days ago: Likely safe to delete
- Last modified > 90 days ago: Very safe to delete
- In ~/Downloads or ~/Desktop: Definitely safe
- In an active project directory: Ask user first

#### Category C: Local AI Models (Safe if not in use)

These are often huge and can be re-downloaded:

```bash
# Ollama models
du -sh ~/.ollama/models 2>/dev/null

# List individual Ollama models
ls -lah ~/.ollama/models/blobs/ 2>/dev/null | head -20

# LM Studio models
du -sh ~/.cache/lm-studio 2>/dev/null

# Hugging Face cache
du -sh ~/.cache/huggingface 2>/dev/null

# GPT4All models
du -sh ~/Library/Application\ Support/nomic.ai 2>/dev/null

# llama.cpp models (check common locations)
du -sh ~/llama.cpp/models 2>/dev/null
du -sh ~/models 2>/dev/null
```

**For AI models, always ask:**
- "Are you actively using [model name]?"
- "This can be re-downloaded if needed"

#### Category D: Docker Artifacts (Safe if not in active use)

```bash
# Check if Docker is installed and running
docker system df 2>/dev/null

# Docker disk usage breakdown
docker system df -v 2>/dev/null | head -30
```

**Docker cleanup options:**
- `docker system prune` - Remove stopped containers, unused networks, dangling images
- `docker system prune -a` - Also remove unused images (more aggressive)
- `docker volume prune` - Remove unused volumes (be careful - may contain data)

#### Category E: Application Caches (Generally Safe)

```bash
# Xcode derived data (often huge for iOS developers)
du -sh ~/Library/Developer/Xcode/DerivedData 2>/dev/null

# iOS device support files
du -sh ~/Library/Developer/Xcode/iOS\ DeviceSupport 2>/dev/null

# Android Studio / Gradle
du -sh ~/.gradle/caches 2>/dev/null
du -sh ~/.android/cache 2>/dev/null

# Spotify cache
du -sh ~/Library/Application\ Support/Spotify/PersistentCache 2>/dev/null

# Chrome cache
du -sh ~/Library/Caches/Google/Chrome 2>/dev/null

# VS Code cache
du -sh ~/Library/Application\ Support/Code/Cache 2>/dev/null
du -sh ~/Library/Application\ Support/Code/CachedData 2>/dev/null
du -sh ~/Library/Application\ Support/Code/CachedExtensions 2>/dev/null
```

#### Category F: Large Files in Common Locations (Needs Review)

```bash
# Large files in Downloads (older than 30 days)
find ~/Downloads -type f -size +100M -mtime +30 2>/dev/null | while read f; do
  size=$(du -sh "$f" 2>/dev/null | cut -f1)
  mod_date=$(stat -f "%Sm" -t "%Y-%m-%d" "$f" 2>/dev/null)
  echo "$size|$mod_date|$f"
done | sort -hr

# Large files in Desktop
find ~/Desktop -type f -size +100M 2>/dev/null | while read f; do
  size=$(du -sh "$f" 2>/dev/null | cut -f1)
  mod_date=$(stat -f "%Sm" -t "%Y-%m-%d" "$f" 2>/dev/null)
  echo "$size|$mod_date|$f"
done | sort -hr

# DMG and PKG files (installers) anywhere in home
find ~ -type f \( -name "*.dmg" -o -name "*.pkg" \) -size +50M 2>/dev/null | while read f; do
  size=$(du -sh "$f" 2>/dev/null | cut -f1)
  mod_date=$(stat -f "%Sm" -t "%Y-%m-%d" "$f" 2>/dev/null)
  echo "$size|$mod_date|$f"
done | sort -hr | head -20
```

#### Category G: System Logs and Caches (Use Caution)

```bash
# System logs
du -sh ~/Library/Logs 2>/dev/null

# General caches
du -sh ~/Library/Caches 2>/dev/null | head -1

# Top cache folders
du -sh ~/Library/Caches/* 2>/dev/null | sort -hr | head -10
```

### 3. Present Findings

Group findings by safety level:

**SAFE TO DELETE (Regenerable)**
- Package manager caches
- Old node_modules (>90 days inactive)
- Docker dangling images
- Xcode derived data

**PROBABLY SAFE (Check first)**
- node_modules (30-90 days inactive)
- AI models you don't recognize
- Old installers (.dmg, .pkg)
- Application caches

**USE CAUTION (May lose data)**
- Docker volumes
- node_modules in active projects
- AI models you might use
- Downloaded files

### 4. Interactive Cleanup

For each category, use AskUserQuestion to confirm actions:

```
Question: "Found X GB in npm cache. This is fully regenerable. Delete it?"
Options:
- "Yes, delete" - Clear the cache
- "No, skip" - Keep it
- "Tell me more" - Explain what this cache does
```

### 5. Execute Cleanup Commands

#### Package Manager Caches

```bash
# npm
npm cache clean --force

# yarn
yarn cache clean

# pnpm
pnpm store prune

# pip
pip cache purge

# Homebrew
brew cleanup --prune=all
```

#### node_modules

```bash
# Delete specific node_modules
rm -rf "/path/to/project/node_modules"

# Or use npkill tool if installed
npx npkill
```

#### Ollama Models

```bash
# List models
ollama list

# Remove specific model
ollama rm model_name
```

#### Docker

```bash
# Safe cleanup
docker system prune

# More aggressive (removes unused images too)
docker system prune -a

# Remove specific image
docker rmi image_name
```

#### Xcode

```bash
# Clear derived data
rm -rf ~/Library/Developer/Xcode/DerivedData/*

# Clear old device support
# List first, then delete selectively
ls ~/Library/Developer/Xcode/iOS\ DeviceSupport/
```

### 6. Summary Report

After cleanup, show:
- Space freed: X GB
- Breakdown by category
- Current disk usage

## Common Space Hogs Reference

| Location | Typical Size | Safety | Notes |
|----------|-------------|--------|-------|
| ~/.npm | 1-10 GB | Very Safe | Regenerates on npm install |
| ~/Library/Caches/Homebrew | 1-5 GB | Very Safe | Regenerates on brew install |
| ~/.ollama/models | 5-50+ GB | Safe* | Re-download with ollama pull |
| ~/.cache/huggingface | 5-50+ GB | Safe* | Re-download on demand |
| node_modules (stale) | 0.5-5 GB each | Safe | npm install recreates |
| ~/Library/Developer/Xcode/DerivedData | 5-50 GB | Safe | Rebuilds automatically |
| Docker images | 5-100+ GB | Varies | Check if containers depend on them |
| ~/Library/Caches/Google/Chrome | 1-5 GB | Safe | Rebuilds as you browse |
| ~/.gradle/caches | 2-10 GB | Safe | Gradle redownloads on build |

*Safe to delete if you're not actively using these models

## Tips for Users

- **node_modules**: If a project is >90 days old and in an archived folder, the node_modules is almost certainly safe to delete. You can always `npm install` again.

- **AI models**: Ollama and Hugging Face models are often 4-70 GB each. If you downloaded a model to try it once, it's probably safe to remove.

- **Docker**: Run `docker system prune` regularly. Run `docker system prune -a` if you want to clear everything except running containers.

- **Xcode**: DerivedData can grow to 50+ GB. It's always safe to delete - Xcode rebuilds it.

- **Prevention**: Consider running this skill monthly to prevent buildup.

## Error Handling

- **Permission denied**: Some system caches require sudo. Skip these and note them.
- **Directory not found**: The tool/app isn't installed. Skip silently.
- **Docker not running**: Note that Docker cleanup was skipped.
- **Command not found**: The package manager isn't installed. Skip silently.

## Example Session

```
User: "What's taking up space on my computer?"

Claude: Let me check your disk usage...

        Current disk: 234 GB used of 500 GB (47% full)
        Home directory: 180 GB

        Scanning for large, safely-deletable files...

        === SAFE TO DELETE (Regenerable) ===

        npm cache: 4.2 GB
        Homebrew cache: 2.1 GB
        Xcode DerivedData: 12.3 GB
        Total: 18.6 GB

        === PROBABLY SAFE ===

        node_modules in ~/old-projects/react-app (last modified: 8 months ago): 890 MB
        node_modules in ~/experiments/test-api (last modified: 4 months ago): 456 MB

        === AI MODELS ===

        Ollama models: 28.4 GB
        - llama2:latest (4.1 GB)
        - codellama:34b (19.0 GB)
        - mistral:latest (4.1 GB)
        - phi:latest (1.2 GB)

        === LARGE DOWNLOADS ===

        ~/Downloads/ubuntu-22.04.iso (4.7 GB, 6 months old)
        ~/Downloads/Xcode_15.dmg (12.1 GB, 3 months old)

        Would you like me to start cleaning up the safe items?

        [Options:]
        - "Clear all safe caches" - Delete npm, Homebrew, Xcode caches (18.6 GB)
        - "Review item by item" - Go through each finding
        - "Just show me the commands" - I'll give you the commands to run yourself
```

## Notes

- Always use `trash` command instead of `rm` when available (recoverable)
- Run `du` commands with timeout to avoid hanging on network drives
- Some caches require the app to be closed first (Chrome, Spotify)
- After Docker cleanup, running containers are never affected
- This skill complements `cleanup-computer` which handles file-by-file organization
