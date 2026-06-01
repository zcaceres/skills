---
name: transcribe-youtube
description: Download and transcribe YouTube videos to a markdown file using yt-dlp and Whisper. Use when user says "transcribe youtube", "transcribe this video", "youtube transcript", or provides a YouTube URL to transcribe.
---

# YouTube Video Transcription

Download a YouTube video's audio and transcribe it to a markdown file using [yt-dlp](https://github.com/yt-dlp/yt-dlp) and [Whisper](https://github.com/openai/whisper).

## Prerequisites

Both tools must be on the user's PATH:

```bash
command -v yt-dlp >/dev/null || echo "Install yt-dlp: https://github.com/yt-dlp/yt-dlp#installation"
command -v whisper >/dev/null || echo "Install Whisper: pip install -U openai-whisper"
```

If either is missing, tell the user how to install it and stop.

## Configuration

- **Output directory:** defaults to `./transcripts/` (relative to the current working directory). If the user names a different destination, use that instead.
- **Whisper model:** `medium` — a good balance of speed and accuracy. Offer `small` for faster/rougher or `large` for slower/more accurate if the user asks.

## Workflow

### Step 1: Set up a temp workspace and output directory

```bash
WORKDIR=$(mktemp -d)
OUTDIR="${OUTDIR:-./transcripts}"   # override by exporting OUTDIR or passing a path
mkdir -p "$OUTDIR"
```

### Step 2: Extract Video Metadata

```bash
yt-dlp --print "%(id)s|||%(title)s|||%(channel)s|||%(upload_date)s" "<URL>"
```

Parse the `|||`-delimited output into:
- `id` — YouTube video ID
- `title` — Video title
- `channel` — Channel name
- `upload_date` — Upload date (YYYYMMDD)

### Step 3: Download Audio

Audio-only is much faster than downloading the full video:

```bash
yt-dlp -x --audio-format mp3 -o "$WORKDIR/%(id)s.%(ext)s" "<URL>"
```

This creates `$WORKDIR/<video-id>.mp3`.

### Step 4: Transcribe with Whisper

```bash
whisper "$WORKDIR/<video-id>.mp3" --model medium --language en --output_format txt --output_dir "$WORKDIR"
```

This creates `$WORKDIR/<video-id>.txt` with the transcript.

### Step 5: Build the Markdown File

Read the transcript and format it with frontmatter:

```markdown
---
title: "<Video Title>"
source: <YouTube URL>
channel: <Channel Name>
date: <YYYY-MM-DD>
transcribed: <today's date>
type: transcript
---

# <Video Title>

**Source:** [<Channel Name>](<YouTube URL>)
**Date:** <YYYY-MM-DD>

---

<Transcript content>
```

### Step 6: Save the Transcript

Sanitize the title for use as a filename:
- Replace `/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, `|` with `-`
- Limit to 100 characters
- Trim whitespace

Save to: `$OUTDIR/<Sanitized-Title>.md`

### Step 7: Clean Up

Remove the temp workspace (keeps the final markdown, discards the audio and raw transcript):

```bash
trash "$WORKDIR"   # or: rm -rf "$WORKDIR" if trash is unavailable
```

### Step 8: Confirm

Tell the user:
- Where the file was saved (`$OUTDIR/<filename>.md`)
- Video title and channel
- Approximate transcript length

## Error Handling

- **Invalid URL:** If yt-dlp fails to recognize the URL, tell the user it's not a valid YouTube URL.
- **Download failed:** The video may be private, age-restricted, or region-locked — report which if yt-dlp says so.
- **Whisper fails:** Check that the audio file exists in `$WORKDIR` and is non-empty.
- **Long videos:** Warn that videos over ~1 hour may take several minutes to transcribe with the `medium` model.

## Notes

- Only the audio is downloaded, to save time and bandwidth.
- The `medium` Whisper model is the default for good accuracy without excessive processing time.
- All intermediate files live in a `mktemp` workspace, so nothing is left behind outside the output directory.
