# VFinder (Multimodal Memory)

Native macOS multimodal memory with semantic search. Embed images, audio, video, PDFs, and text into a local vector database, then search across all of them with natural language.

Powered by [Gemini Embedding 2](https://ai.google.dev/gemini-api/docs/embeddings), [ChromaDB](https://www.trychroma.com/), and [Tauri](https://tauri.app/).

---

## 🖥 Desktop App (Recommended)

The easiest way to use VFinder is with the native macOS application.

### Features
- 🏎️ **Instant Search**: Persistent background daemon for sub-200ms results.
- 🖼️ **Visual Search**: Beautiful grid view with image previews.
- 📁 **Drag-and-Drop**: Drop folders or files to instantly index them.
- 🛠️ **Database Manager**: View, filter, and delete memories directly.
- ⌨️ **Keyboard First**: `⌘K` to search, `⌘1-3` to switch views.
- 🔒 **Local First**: All data is stored in `~/.vfinder/` on your machine.

### Developer Setup (Run from source)

**Prerequisites:**
- Rust toolchain (`rustup`)
- Python 3.11+
- Node.js & npm
- [uv](https://docs.astral.sh/uv/) (Recommended for managing the Python virtual environment)

1. **Install Python dependencies:**
   ```bash
   uv venv
   uv pip install -e .
   ```

2. **Run in development mode:**
   ```bash
   cd vfinder-desktop
   npm install
   npm run tauri dev
   ```
   *The Rust backend will automatically detect `.venv/bin/python3` and run the Python background daemon on port 32034.*

### Building for Production
To create a completely standalone `.dmg` that doesn't require Python/Rust installed:
```bash
chmod +x build.sh
./build.sh
```
*Note: The build script cleanly compiles the Python backend using PyInstaller (`--onedir`) and bundles it directly into the Tauri App `resources/`. This entirely bypasses Apple's strict POSIX semaphore restrictions around extracted binaries.*

The output will be perfectly packaged at: `vfinder-desktop/src-tauri/target/release/bundle/dmg/`

---

## 🐍 Python Library & CLI

VFinder can also be used as a standalone Python library for your own scripts.

### Installation
```bash
git clone https://github.com/hughminhphan/vector-embedded-finder.git
cd vector-embedded-finder
pip install -e .
```

### Usage
```python
from vector_embedded_finder import search, ingest_file, ingest_directory, count

# Embed a single file
ingest_file("~/Photos/vacation.jpg")

# Search with natural language
matches = search("sunset at the beach", n_results=5)
for m in matches:
    print(f"{m['file_name']} - {m['similarity']:.0%} match")
```

---

## 🪄 Raycast Extension (Legacy)

The `raycast/` directory contains the original Raycast extension logic. Note that the Desktop App is now the primary focus for performance and visual features.

---

## ⚙️ Configuration

- **API Key**: Set your `GEMINI_API_KEY` in the Desktop App's **Settings** tab. It is stored securely in `~/.vfinder/settings.json`.
- **Data Path**: All vector data is stored in `~/.vfinder/data/chromadb/`.

## 📄 License
MIT
