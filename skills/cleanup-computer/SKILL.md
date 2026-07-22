---
name: cleanup-computer
description: Interactive file cleanup for Downloads, Desktop, and Documents, plus stale git worktree cleanup. Goes item-by-item proposing delete, move, or keep. Use when user says "clean up my computer", "organize my downloads", "help me declutter", "what's in my Downloads", "file cleanup", or "clean up old worktrees".
---

# Computer Cleanup Workflow

This skill helps you systematically clean up and organize files in the user's Downloads, Desktop, and Documents folders. It processes files one-by-one, showing each file and proposing an appropriate action: **delete**, **move**, or **keep**.

It also cleans up stale **git worktrees** across the user's repos — finding worktrees that are safe to remove (clean and fully merged) and proposing removal one-by-one. See [Git Worktree Cleanup](#git-worktree-cleanup).

## When to Use This Skill

Use this skill when the user requests:
- "Clean up my computer"
- "Organize my downloads"
- "Help me declutter"
- "What's in my Downloads folder?"
- "File cleanup"
- "Go through my files"

## Workflow Steps

### 1. Initialize Cleanup Session

Start by informing the user:
- "I'll help you clean up your files, going through them one by one."
- "We'll start with Downloads, then Desktop, then Documents."
- "For each file, I'll propose an action: delete, move, or keep."

### 2. Process Folders in Order

Process folders in this order:
1. `~/Downloads`
2. `~/Desktop`
3. `~/Documents`

List the files in a folder, most recent first:
```bash
find ~/Downloads -maxdepth 1 -type f -print0 | xargs -0 ls -lt 2>/dev/null | head -20
```

Skip these system/hidden files:
- `.DS_Store`
- `.localized`
- Files starting with `.`

### 3. For Each File, Analyze and Propose

For each file found:

#### a. Read/Analyze the File
- For PDFs: Read and summarize content
- For images: View and describe
- For documents: Read and summarize
- For archives (.zip, .dmg): List contents if possible
- For other files: Show file info (size, date, type)

#### b. Categorize the File Type
Determine what kind of file it is:
- **Screenshot**: Often deletable, but check if it contains important info
- **Downloaded installer** (.dmg, .pkg): Usually deletable after install
- **Archive** (.zip): Check contents, often intermediate/deletable
- **Document** (.pdf, .docx): May need to be filed or kept
- **Image** (.jpg, .png): Could be a screenshot, photo, or downloaded image
- **Code/config files**: Might belong in a project folder
- **Media** (.mp4, .mp3): Could be moved to an appropriate location
- **Temporary files**: Usually deletable

#### c. Propose an Action

Use AskUserQuestion to present options based on file type:

**For likely deletable files (old installers, temp files, duplicates):**
```
Question: "What should we do with [filename]? (Downloaded [date], [size])"
Options:
- "Delete" - Move to trash
- "Keep for now" - Leave in place
- "Tell me more" - Show more details about this file
```

**For documents/files that might need organizing:**
```
Question: "What should we do with [filename]? [Brief summary of content]"
Options:
- "Delete" - Move to trash
- "Move to [suggested folder]" - Move locally
- "Keep in place" - Leave where it is
```

### 4. Execute the Chosen Action

Based on the user's choice:

#### Delete
```bash
trash "[file_path]"
```
Confirm: "Moved [filename] to trash."

#### Move Locally

**Important**: Analyze the file content and suggest an appropriate destination based on context.

Suggest a destination folder based on:
- **File content**: What is the document about?
- **File name clues**: Keywords in the filename (e.g., "report" → a reports folder)
- **File type patterns**:
  - Documents → `~/Documents`
  - Images/photos → `~/Pictures`
  - Media → `~/Movies` or `~/Music`
  - Code/config → the relevant project folder

```
Question: "Where should I move [filename]?"
Options:
- "[Suggested Folder]" - Based on analysis: [brief reason why this folder fits]
- "Documents" - General documents folder
- "Let me specify" - Choose a different folder
```

If the user chooses to specify, ask for a path and create it if it doesn't exist:
```bash
mkdir -p "[destination_dir]"
mv "[source_path]" "[destination_path]"
```
Confirm: "Moved [filename] to [destination]."

#### Keep
Simply move to the next file.

### 5. Progress Updates

After every 5 files, provide a summary:
- Files processed: X
- Deleted: Y
- Moved: Z
- Kept: K

Ask: "Continue with the next batch of files?"

### 6. Folder Transition

When finishing a folder:
- Summarize actions taken in that folder
- Ask: "Ready to move on to [next folder]?"

### 7. Session Complete

When all folders are processed:
- Provide a final summary of all actions
- Mention if there are still files remaining (deeper in folders)

## Git Worktree Cleanup

After (or instead of) file cleanup, offer to sweep stale git worktrees. Trigger on "clean up old worktrees", "prune worktrees", or as a follow-up once folders are done: "Want me to also check for stale git worktrees?"

A worktree is a **safe deletion candidate** only when ALL of these hold:
- It is **not** the main worktree (never remove the primary checkout).
- It is **not** locked (`locked` absent in porcelain output).
- Its working tree is **clean** — no uncommitted or untracked changes.
- Its branch is **fully merged** into the trunk (or its directory is already gone → prunable).

Anything with uncommitted changes, unmerged/unpushed commits, or a lock is **kept** and flagged, not removed.

### 1. Discover repos and worktrees

Worktrees are registered per-repo, so find repos first, then list each one's worktrees. Ask the user for a search root, or default to common dev locations:

```bash
# Find git repos under common roots (adjust roots to the user's setup)
for root in ~/projects ~/code ~/src ~/git ~/dev ~/work; do
  [ -d "$root" ] && find "$root" -maxdepth 3 -type d -name .git -prune 2>/dev/null
done | sed 's:/\.git$::' | sort -u
```

For each repo, list its worktrees in machine-readable form:

```bash
git -C "<repo>" worktree list --porcelain
```

Porcelain fields per worktree: `worktree <path>`, `HEAD <sha>`, `branch <ref>` (or `detached`), and optionally `bare`, `locked`, `prunable`. The first entry is the main worktree — skip it.

### 2. Classify each linked worktree

For every non-main worktree:

```bash
wt="<worktree-path>"
# Clean? (empty output = clean)
git -C "$wt" status --porcelain

# Branch merged into trunk? (empty output = fully merged, safe)
# Detect trunk: prefer origin/HEAD, else main, else master
git -C "$wt" log --oneline <trunk>..HEAD
```

- `status` empty **and** `log <trunk>..HEAD` empty → **safe candidate**.
- Marked `prunable` (directory missing) → **safe to prune**.
- Otherwise → **keep** (report why: dirty, or has N unmerged commits).

### 3. Propose per worktree

Use AskUserQuestion, safe candidates first:

**Safe candidate:**
```
Question: "Remove worktree [path]? (branch [name], clean, merged into [trunk])"
Options:
- "Remove" - Delete the worktree (branch is kept)
- "Remove + delete branch" - Also delete the merged branch
- "Keep" - Leave it in place
```

**Not safe (report, don't offer removal by default):**
```
"[path] has uncommitted changes / N unmerged commits — keeping it. Force-remove anyway?"
```

### 4. Execute

```bash
# Safe removal — refuses if dirty, so never pass --force
git -C "<repo>" worktree remove "<worktree-path>"

# Prune stale registrations (directory already gone)
git -C "<repo>" worktree prune

# Only if user chose "Remove + delete branch" and it is merged:
git -C "<repo>" branch -d "<branch>"
```

Confirm: "Removed worktree [path]."

**Never use `git worktree remove --force`** — it discards uncommitted work irrecoverably, and it is exactly what the "safe candidate" gate exists to prevent. If the user insists on removing a dirty worktree, surface the diff first and require explicit confirmation. `branch -d` (safe, refuses unmerged) not `-D`.

### 5. Cautions specific to worktrees

- The git **stash stack is shared** across all worktrees of a repo. A worktree with no local changes may still hold stashed work — mention this if the branch looks abandoned.
- A worktree may be **another agent's or session's active workspace**. Prefer worktrees untouched for a while; when unsure, keep.
- Removing a worktree does **not** delete its branch or commits — those live in the repo. That is why clean+merged removal loses nothing.

## File Type Decision Guide

### Usually Safe to Delete
- `.dmg` files (installers, especially if old)
- `.pkg` files (installers)
- Duplicate files (same name with " (1)", " copy")
- Screenshots older than 30 days
- Empty files
- `.zip` archives that have been extracted
- Temporary files (`.tmp`, `.temp`)
- Browser downloads like `download.pdf`, `document (1).pdf`

### Likely Needs Review
- PDFs (could be important documents)
- Word/Excel documents
- Images that aren't screenshots
- Archives with unknown contents

### Skip / Special Handling
- Active project files: Leave in place
- System files: Don't touch

## Error Handling

- **File in use**: Skip and note it, come back later
- **Permission denied**: Inform the user, skip the file
- **File not found**: May have been moved/deleted, skip

## Example Session

```
User: "Clean up my computer"

Claude: I'll help you clean up your files, going through them one by one.
        Starting with Downloads...

        Found 12 files in ~/Downloads.

        File 1: "Quarterly-Report.pdf" (245 KB, downloaded 3 days ago)
        This appears to be a work report.

        [Options presented:]
        - "Move to Documents/Reports" - Looks like a work report
        - "Delete" - Move to trash
        - "Keep in place" - Leave in Downloads

User: [Selects "Move to Documents/Reports"]

Claude: Moved Quarterly-Report.pdf to ~/Documents/Reports.
        Moving to next file...

        File 2: "Zoom-installer.dmg" (15 MB, downloaded 2 weeks ago)
        This is an application installer for Zoom.

        [Options presented:]
        - "Delete" - Installer likely no longer needed
        - "Keep for now" - Leave in place
```

## Notes

- **ALWAYS use `trash` instead of `rm`, `rm -rf`, or `rm -r` for ALL deletions** — files, directories, caches, everything. This ensures recoverability. The only exceptions are commands that manage their own cleanup (e.g., `npm cache clean --force`, `brew cleanup`, and `git worktree remove` for clean+merged worktrees, whose branch and commits survive removal).
- Always read/analyze file content before suggesting a destination
- The suggested destination should be the first option presented
- Include a brief reason why the destination was suggested
- Learn from the user's choices during the session (if they keep picking a certain folder for a file type, prioritize it)
- When uncertain about content, default to keeping the file in place
