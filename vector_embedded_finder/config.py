"""Configuration for the vector-embedded-finder package."""

from __future__ import annotations

import os
import json
from pathlib import Path

# ─── Settings Resolution ─────────────────────────────────────────────
# Priority: env vars > ~/.vfinder/settings.json > defaults
SETTINGS_DIR = Path.home() / ".vfinder"
SETTINGS_FILE = SETTINGS_DIR / "settings.json"

def _load_settings() -> dict:
    if SETTINGS_FILE.exists():
        try:
            return json.loads(SETTINGS_FILE.read_text())
        except:
            pass
    return {}

_settings = _load_settings()

# ─── Data Paths ──────────────────────────────────────────────────────
# Default data dir is now ~/.vfinder/data (user-space, not project-relative)
_default_data_dir = str(SETTINGS_DIR / "data")
DATA_DIR = Path(os.environ.get("VEF_DATA_DIR", _settings.get("data_dir", _default_data_dir)))
CHROMA_DIR = DATA_DIR / "chromadb"

# Ensure dirs exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
CHROMA_DIR.mkdir(parents=True, exist_ok=True)

COLLECTION_NAME = "vector_embedded_finder"

SUPPORTED_EXTENSIONS = {
    "image": {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tiff"},
    "audio": {".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac"},
    "video": {".mp4", ".mov", ".avi", ".mkv", ".webm"},
    "document": {".pdf"},
    "text": {".txt", ".md", ".csv", ".json", ".yaml", ".yml", ".toml", ".xml", ".html", ".py", ".js", ".ts", ".go", ".rs", ".sh"},
}

ALL_EXTENSIONS = set()
for exts in SUPPORTED_EXTENSIONS.values():
    ALL_EXTENSIONS.update(exts)

EMBEDDING_MODEL = "gemini-embedding-2-preview"
EMBEDDING_DIMENSIONS = 768
MAX_TEXT_TOKENS = 8192


def get_api_key() -> str:
    """Resolve API key: env var > settings file > .env fallback."""
    # 1. Check environment variable (may have been set by server.py)
    key = os.environ.get("GEMINI_API_KEY", "")
    if key:
        return key

    # 2. Check settings file
    key = _settings.get("api_key", "")
    if key:
        os.environ["GEMINI_API_KEY"] = key
        return key

    # 3. Try .env as last resort (dev mode)
    try:
        from dotenv import load_dotenv
        # Look for .env in several locations
        for candidate in [Path.cwd() / ".env", Path(__file__).parent.parent / ".env"]:
            if candidate.exists():
                load_dotenv(candidate)
                key = os.environ.get("GEMINI_API_KEY", "")
                if key:
                    return key
    except ImportError:
        pass

    raise ValueError(
        "GEMINI_API_KEY not set. Configure it in Settings or set as environment variable."
    )


def get_media_category(ext: str) -> str | None:
    ext = ext.lower()
    for category, extensions in SUPPORTED_EXTENSIONS.items():
        if ext in extensions:
            return category
    return None
