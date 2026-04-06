"""Gemini Embedding 2 API wrapper for multimodal embedding."""

from __future__ import annotations

from pathlib import Path

from google import genai
from google.genai import types

from . import config
from . import utils


_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=config.get_api_key())
    return _client


def _embed_content(contents: types.Content | str, task: str) -> list[float]:
    client = _get_client()
    result = client.models.embed_content(
        model=config.EMBEDDING_MODEL,
        contents=contents,
        config=types.EmbedContentConfig(
            task_type=task,
            output_dimensionality=config.EMBEDDING_DIMENSIONS,
        ),
    )
    return result.embeddings[0].values


def _embed_file(
    path: Path, mime_type: str | None = None, task: str = "RETRIEVAL_DOCUMENT"
) -> list[float]:
    with open(path, "rb") as f:
        data = f.read()

    mt = mime_type or utils.mime_type(path)

    contents = types.Content(
        parts=[types.Part(inline_data=types.Blob(mime_type=mt, data=data))]
    )
    return _embed_content(contents, task)


def embed_text(text: str, task: str = "RETRIEVAL_DOCUMENT") -> list[float]:
    return _embed_content(text, task)


def embed_query(query: str) -> list[float]:
    return embed_text(query, task="RETRIEVAL_QUERY")


def embed_image(path: Path) -> list[float]:
    return _embed_file(path)


def embed_audio(path: Path) -> list[float]:
    return _embed_file(path)


def embed_video(path: Path) -> list[float]:
    return _embed_file(path)


def embed_pdf(path: Path) -> list[float]:
    return _embed_file(path, mime_type="application/pdf")
