# vector-embedded-finder

Local multimodal memory with semantic search. Embed images, audio, video, PDFs, and text into a local vector database, then search across all of them with natural language. Comes with a Raycast extension for instant visual search.

Powered by [Gemini Embedding 2](https://ai.google.dev/gemini-api/docs/embeddings) and [ChromaDB](https://www.trychroma.com/).

## How it works

```
You                     Gemini Embedding 2          ChromaDB
 |                            |                        |
 |-- embed a photo ---------->|-- 768-dim vector ------>|-- stored locally
 |-- embed a PDF ------------>|-- 768-dim vector ------>|-- stored locally
 |-- "sunset at the beach" -->|-- query vector -------->|-- cosine search
 |<-- top 5 matches ---------|<-- ranked results -------|
```

Cross-modal search works out of the box. A text query like "team dinner" will match photos from that event, even though the photos have no text metadata.

## Quickstart

### 1. Install the Python package

```bash
git clone https://github.com/hughminhphan/vector-embedded-finder.git
cd vector-embedded-finder
pip install -e .
```

### 2. Set your Gemini API key

Get a free key from [Google AI Studio](https://aistudio.google.com/apikey).

```bash
cp .env.example .env
# Edit .env and add your key
```

### 3. Use it

```python
from vector_embedded_finder import search, ingest_file, ingest_directory, count

# Embed a single file (image, PDF, audio, video, or text)
result = ingest_file("~/Photos/team-dinner.jpg")

# Embed an entire directory
results = ingest_directory("~/Photos/2026/", source="photos")

# Search with natural language
matches = search("team dinner", n_results=5)
for m in matches:
    print(f"{m['file_name']} - {m['similarity']:.0%} match")

# Check how many items are stored
print(f"{count()} items in memory")
```

## Raycast extension

The `raycast/` directory contains a Raycast extension for visual grid search with image thumbnails.

### Setup

```bash
cd raycast
npm install
npx ray develop
```

On first launch, Raycast will prompt you to set:

- **Python Package Path** - absolute path to this repo (e.g. `/Users/you/vector-embedded-finder`)
- **Python Binary** - path to `python3` (defaults to `python3`)

### Features

- **Memory Search** - grid UI with image/video thumbnails, 400ms debounced search
- **Memory Open** - headless command that opens the best-matching file instantly

## Supported file types

| Category | Extensions |
|----------|-----------|
| Image | `.png` `.jpg` `.jpeg` `.webp` `.gif` `.bmp` `.tiff` |
| Audio | `.mp3` `.wav` `.m4a` `.ogg` `.flac` `.aac` |
| Video | `.mp4` `.mov` `.avi` `.mkv` `.webm` |
| Document | `.pdf` |
| Text | `.txt` `.md` `.csv` `.json` `.yaml` `.py` `.js` `.ts` `.go` `.rs` `.sh` and more |

## Architecture

```
vector_embedded_finder/
  config.py      - settings, API key, supported types
  embedder.py    - Gemini Embedding 2 wrapper (text, image, audio, video, PDF)
  store.py       - ChromaDB persistence layer (cosine distance, SHA-256 dedup)
  search.py      - natural language search with similarity scoring
  ingest.py      - file detection, embedding, and storage pipeline
  utils.py       - hashing, MIME detection, helpers

raycast/
  src/search-memory.tsx  - grid search UI with thumbnails
  src/open-memory.tsx    - instant file opener
```

All data is stored locally in `data/chromadb/`. Nothing leaves your machine except the embedding API calls to Google.

## Configuration

| Environment variable | Default | Description |
|---------------------|---------|-------------|
| `GEMINI_API_KEY` | (required) | Your Gemini API key |
| `VEF_DATA_DIR` | `./data` | Where ChromaDB stores vectors |

## License

MIT
