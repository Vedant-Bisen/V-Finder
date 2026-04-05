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

# ─── Step 1: Determine architecture ─────────────────────────────────
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

# ─── Step 2: Install PyInstaller ─────────────────────────────────────
echo ""
echo "📦 Step 1/4: Installing PyInstaller..."
pip install pyinstaller --quiet 2>/dev/null || pip3 install pyinstaller --quiet

# ─── Step 3: Build Python sidecar binary ─────────────────────────────
echo "🐍 Step 2/4: Building Python sidecar binary..."
cd "$PROJECT_DIR"

pyinstaller \
    --onefile \
    --name vfinder-server \
    --hidden-import vector_embedded_finder \
    --hidden-import vector_embedded_finder.config \
    --hidden-import vector_embedded_finder.embedder \
    --hidden-import vector_embedded_finder.store \
    --hidden-import vector_embedded_finder.ingest \
    --hidden-import vector_embedded_finder.search \
    --hidden-import vector_embedded_finder.utils \
    --hidden-import chromadb \
    --hidden-import google.genai \
    --collect-all chromadb \
    --collect-all google.genai \
    --noconfirm \
    --clean \
    server.py

# ─── Step 4: Copy sidecar to Tauri binaries ──────────────────────────
echo "📋 Step 3/4: Copying sidecar to Tauri binaries..."
mkdir -p "$BINARIES_DIR"

# Tauri expects the binary named with the target triple suffix
cp "$PROJECT_DIR/dist/vfinder-server" "$BINARIES_DIR/vfinder-server-${TARGET_TRIPLE}"
chmod +x "$BINARIES_DIR/vfinder-server-${TARGET_TRIPLE}"

echo "   → $BINARIES_DIR/vfinder-server-${TARGET_TRIPLE}"

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
