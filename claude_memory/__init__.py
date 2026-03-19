"""Local multimodal memory with semantic search, powered by Gemini Embedding 2 and ChromaDB."""

from .search import search
from .ingest import ingest_file, ingest_text, ingest_directory
from .store import count, delete, list_all

__all__ = ["search", "ingest_file", "ingest_text", "ingest_directory", "count", "delete", "list_all"]
