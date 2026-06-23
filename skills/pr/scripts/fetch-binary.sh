#!/usr/bin/env bash
# fetch-binary.sh — make sure this skill's prebuilt hook binary exists in
# scripts/bin/ for the host OS/arch. Idempotent; safe to run repeatedly.
#
# Why this exists: the compiled bun binaries are large build artifacts, so they
# are gitignored, never committed, and rebuilt/redownloaded on demand. A pure
# file-copy install (`npx skills add`, a sparse git checkout) therefore lands
# the source + run.sh but no binary, and run.sh then no-ops. This script closes
# that gap so the install actually works.
#
# Layered provisioning (first that succeeds wins):
#   1. Binary already present + executable          -> done.
#   2. Download the prebuilt binary for this platform from this skill's GitHub
#      release (needs `gh`). The path that works on machines without a Bun
#      toolchain — this is what makes the npx/file-copy experience just work.
#   3. Build locally with `bun` (always matches the local source).
#   4. Print manual instructions and exit non-zero.
#
# Generic across every binary-bundling skill in this repo: it derives the skill
# name from its own location and globs the release asset by platform suffix, so
# it needs no per-skill configuration and no knowledge of the binary's base
# name (e.g. `pr-nudge` for the `pr` skill).
#
# Env overrides:
#   SKILL_BINARY_REPO  owner/repo to fetch releases from (default: zcaceres/skills)
#   SKILL_BINARY_TAG   exact release tag to pull (default: latest <skill>@*)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SKILL_NAME="$(basename "$SKILL_DIR")"
BIN_DIR="$SCRIPT_DIR/bin"
REPO="${SKILL_BINARY_REPO:-zcaceres/skills}"

# --- platform -> asset suffix (mirrors run.sh's binary selection) ---
OS="$(uname -s)"
ARCH="$(uname -m)"
case "$OS" in
  Darwin)
    case "$ARCH" in
      arm64)          PLATFORM="darwin-arm64" ;;
      x86_64)         PLATFORM="darwin-x64" ;;
      *) echo "fetch-binary: unsupported macOS arch: $ARCH" >&2; exit 1 ;;
    esac ;;
  Linux)
    case "$ARCH" in
      x86_64|amd64)   PLATFORM="linux-x64" ;;
      aarch64|arm64)  PLATFORM="linux-arm64" ;;
      *) echo "fetch-binary: unsupported Linux arch: $ARCH" >&2; exit 1 ;;
    esac ;;
  *)
    echo "fetch-binary: unsupported OS: $OS." >&2
    echo "  On Windows, use scripts\\bin\\*-windows-x64.exe (build with 'bun run build:all')." >&2
    exit 1 ;;
esac

# Resolve the binary already sitting in BIN_DIR for this platform, if any.
present_binary() {
  local f
  for f in "$BIN_DIR"/*-"$PLATFORM"; do
    [ -e "$f" ] && { printf '%s\n' "$f"; return 0; }
  done
  return 1
}

# --- 1. already present? ---
if existing="$(present_binary)" && [ -x "$existing" ]; then
  echo "✓ $SKILL_NAME binary already present: $existing"
  exit 0
fi

mkdir -p "$BIN_DIR"

# --- 2. download from this skill's GitHub release (needs gh) ---
if command -v gh >/dev/null 2>&1; then
  TAG="${SKILL_BINARY_TAG:-}"
  if [ -z "$TAG" ]; then
    TAG="$(gh release list --repo "$REPO" --json tagName \
            -q "[.[].tagName | select(startswith(\"${SKILL_NAME}@\"))] | .[0] // empty" \
            2>/dev/null || true)"
  fi
  if [ -n "$TAG" ]; then
    if gh release download "$TAG" --repo "$REPO" --pattern "*-$PLATFORM" \
         --dir "$BIN_DIR" --clobber >/dev/null 2>&1 && fetched="$(present_binary)"; then
      chmod +x "$fetched"
      echo "✓ Downloaded $SKILL_NAME binary from $REPO ($TAG) -> $fetched"
      exit 0
    fi
    echo "fetch-binary: no $PLATFORM asset on release $TAG; falling back to local build." >&2
  else
    echo "fetch-binary: no published ${SKILL_NAME}@* release found; falling back to local build." >&2
  fi
fi

# --- 3. build locally with bun ---
if command -v bun >/dev/null 2>&1; then
  # Prefer a build script that targets only this host platform (one ~60MB
  # binary instead of every platform). Skills name these scripts slightly
  # differently, so try the known aliases and fall back to build:all.
  case "$PLATFORM" in
    darwin-arm64) CANDIDATES="build:macos build:darwin-arm64 build:darwin" ;;
    darwin-x64)   CANDIDATES="build:darwin-x64" ;;
    linux-x64)    CANDIDATES="build:linux build:linux-x64" ;;
    linux-arm64)  CANDIDATES="build:linux-arm64" ;;
    *)            CANDIDATES="" ;;
  esac
  BUILD_SCRIPT="build:all"
  if command -v jq >/dev/null 2>&1; then
    for c in $CANDIDATES; do
      if jq -e --arg k "$c" '.scripts[$k]' "$SKILL_DIR/package.json" >/dev/null 2>&1; then
        BUILD_SCRIPT="$c"; break
      fi
    done
  fi
  echo "Building $SKILL_NAME binary locally with bun ($BUILD_SCRIPT, one-time, may take a moment)…" >&2
  ( cd "$SKILL_DIR" && bun install --silent && bun run "$BUILD_SCRIPT" ) >&2
  if built="$(present_binary)" && [ -x "$built" ]; then
    echo "✓ Built $SKILL_NAME binary -> $built"
    exit 0
  fi
  echo "fetch-binary: bun build did not produce a $PLATFORM binary." >&2
fi

# --- 4. manual fallback ---
{
  echo "✗ Could not provision the $SKILL_NAME binary for $PLATFORM."
  echo "  Install one of, then re-run $SCRIPT_DIR/fetch-binary.sh :"
  echo "    • gh  (GitHub CLI)  — downloads a prebuilt binary"
  echo "    • bun (https://bun.sh) — builds it from source"
} >&2
exit 1
