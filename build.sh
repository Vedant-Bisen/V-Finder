#!/bin/bash
# ─── VFinder Build Script ────────────────────────────────────────────
# Builds the complete distributable macOS application.
# 
# Prerequisites:
#   - Python 3.11+ with pip
#   - Rust toolchain (rustc, cargo)
#   - Node.js + npm
#
# Usage:
#   chmod +x build.sh
#   ./build.sh
# ─────────────────────────────────────────────────────────────────────

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
TAURI_DIR="$PROJECT_DIR/vfinder-desktop"
BINARIES_DIR="$TAURI_DIR/src-tauri/binaries"

echo "╔══════════════════════════════════════╗"
echo "║     VFinder Desktop Build Script     ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ─── Step 1: Determine architecture & environment ──────────────────────
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
    TARGET_TRIPLE="aarch64-apple-darwin"
elif [ "$ARCH" = "x86_64" ]; then
    TARGET_TRIPLE="x86_64-apple-darwin"
else
    echo "❌ Unsupported architecture: $ARCH"
    exit 1
fi
echo "🖥  Architecture: $ARCH ($TARGET_TRIPLE)"

# Activate virtual environment so PyInstaller gets installed with dependencies
echo "🔧 Resolving virtual environment..."
VENV_PYTHON="$PROJECT_DIR/.venv/bin/python"
VENV_PYINSTALLER="$PROJECT_DIR/.venv/bin/pyinstaller"

# ─── Step 2: Install PyInstaller ─────────────────────────────────────
echo ""
echo "📦 Step 1/4: Installing PyInstaller..."

# If the user uses `uv`, their venv likely doesn't have pip installed by default.
if command -v uv &> /dev/null; then
    uv pip install "pyinstaller==6.19.0" --quiet
else
    # Otherwise fallback to ensurepip -> pip
    "$VENV_PYTHON" -m ensurepip --upgrade --quiet 2>/dev/null || true
    "$VENV_PYTHON" -m pip install "pyinstaller==6.19.0" --quiet
fi

# ─── Step 3: Build Python backend directory ────────────────────────────
echo "🐍 Step 2/4: Building Python backend directory..."
cd "$PROJECT_DIR"

export PYINSTALLER_CONFIG_DIR="$PROJECT_DIR/.pyi_config"

"$VENV_PYINSTALLER" \
    --onedir \
    --name vfinder-server \
    --hidden-import google \
    --hidden-import google.genai \
    --hidden-import chromadb \
    --hidden-import chromadb.api.segment \
    --hidden-import chromadb.telemetry.posthog \
    --collect-all google-genai \
    --collect-all chromadb \
    --noconfirm \
    --clean \
    server.py

# ─── Step 4: Copy backend to Tauri binaries ──────────────────────────
echo "📋 Step 3/4: Copying backend to Tauri resources..."
rm -rf "$BINARIES_DIR/vfinder-backend"
mkdir -p "$BINARIES_DIR/vfinder-backend"

# Copy the generated directory
cp -r "$PROJECT_DIR/dist/vfinder-server/"* "$BINARIES_DIR/vfinder-backend/"
chmod -R +x "$BINARIES_DIR/vfinder-backend"

echo "   → $BINARIES_DIR/vfinder-backend/"

# ─── Step 5: Build Tauri app ─────────────────────────────────────────
echo "🦀 Step 4/4: Building Tauri desktop application..."
cd "$TAURI_DIR"
npm install
npm run tauri build

# ─── Done ────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════╗"
echo "║          ✅ Build Complete!          ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "Your .dmg is ready at:"
echo "  $TAURI_DIR/src-tauri/target/release/bundle/dmg/"
echo ""
echo "Upload it to GitHub Releases and share!"
