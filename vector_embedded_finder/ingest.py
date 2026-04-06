"""File ingestion pipeline - detect type, embed, store."""

from __future__ import annotations

from pathlib import Path
from typing import Callable

from . import config, embedder, store, utils


def ingest_file(
    path: str | Path,
    source: str = "manual",
    description: str = "",
) -> dict:
    path = Path(path).resolve()
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")

    if not utils.is_supported(path):
        raise ValueError(f"Unsupported file type: {path.suffix}")

    category = config.get_media_category(path.suffix.lower())
    doc_id = utils.file_hash(path)

    if store.exists(doc_id):
        return {"status": "skipped", "reason": "already embedded", "id": doc_id, "path": str(path)}

    if category == "text":
        text = path.read_text(errors="replace")
        if len(text) > 32000:
            text = text[:32000]
        embedding = embedder.embed_text(text)
        doc_text = text[:500]
    elif category == "image":
        embedding = embedder.embed_image(path)
        doc_text = description or f"Image: {path.name}"
    elif category == "audio":
        embedding = embedder.embed_audio(path)
        doc_text = description or f"Audio: {path.name}"
    elif category == "video":
        embedding = embedder.embed_video(path)
        doc_text = description or f"Video: {path.name}"
    elif category == "document":
        embedding = embedder.embed_pdf(path)
        doc_text = description or f"PDF: {path.name}"
    else:
        raise ValueError(f"Unknown category: {category}")

    metadata = {
        "file_path": str(path),
        "file_name": path.name,
        "file_type": utils.mime_type(path),
        "media_category": category,
        "timestamp": utils.now_iso(),
        "source": source,
        "description": description,
        "file_size": path.stat().st_size,
    }

    store.add(doc_id, embedding, metadata, document=doc_text)
    return {"status": "embedded", "id": doc_id, "path": str(path), "category": category}


def ingest_text(
    text: str,
    description: str = "",
    source: str = "manual",
    tags: str = "",
) -> dict:
    doc_id = utils.text_hash(text)

    if store.exists(doc_id):
        return {"status": "skipped", "reason": "already embedded", "id": doc_id}

    embedding = embedder.embed_text(text)

    metadata = {
        "file_path": "",
        "file_name": "",
        "file_type": "text/plain",
        "media_category": "text",
        "timestamp": utils.now_iso(),
        "source": source,
        "description": description,
        "tags": tags,
        "file_size": len(text.encode()),
    }

    store.add(doc_id, embedding, metadata, document=text[:500])
    return {"status": "embedded", "id": doc_id, "category": "text"}


def ingest_directory(
    path: str | Path,
    source: str = "manual",
    recursive: bool = True,
    progress_callback: Callable | None = None,
    batch_size: int = 50,
) -> list[dict]:
    path = Path(path).resolve()
    results = []
    pattern = "**/*" if recursive else "*"

    files = [f for f in sorted(path.glob(pattern)) if f.is_file() and utils.is_supported(f)]
    total = len(files)

    if total == 0:
        return []

    # Process in batches to reduce store.exists overhead and potentially batch embeddings
    for i in range(0, total, batch_size):
        batch_files = files[i : i + batch_size]
        batch_results = _process_batch(batch_files, source, i + 1, total, progress_callback)
        results.extend(batch_results)

    return results


def _process_batch(
    files: list[Path],
    source: str,
    start_index: int,
    total: int,
    progress_callback: Callable | None,
) -> list[dict]:
    results_map = {}

    # 1. Calculate hashes and check existence in bulk
    file_hashes = {}
    for f in files:
        try:
            file_hashes[f] = utils.file_hash(f)
        except Exception as e:
            results_map[f] = {"status": "error", "path": str(f), "error": str(e)}

    # Filter out files that failed hashing
    remaining_files = [f for f in files if f in file_hashes]
    doc_ids = [file_hashes[f] for f in remaining_files]

    existing_ids = store.exists_many(doc_ids)

    files_to_embed = []
    for f in remaining_files:
        doc_id = file_hashes[f]
        if doc_id in existing_ids:
            results_map[f] = {"status": "skipped", "reason": "already embedded", "id": doc_id, "path": str(f)}
        else:
            files_to_embed.append(f)

    # 2. Group by category for potential batch embedding (especially text)
    by_category = {}
    for f in files_to_embed:
        category = config.get_media_category(f.suffix.lower())
        by_category.setdefault(category, []).append(f)

    # 3. Process text files in batch
    if "text" in by_category:
        text_files = by_category["text"]
        text_contents = []
        valid_text_files = []

        for f in text_files:
            try:
                text = f.read_text(errors="replace")
                if len(text) > 32000:
                    text = text[:32000]
                text_contents.append(text)
                valid_text_files.append(f)
            except Exception as e:
                results_map[f] = {"status": "error", "path": str(f), "error": str(e)}

        if text_contents:
            try:
                embeddings = embedder.embed_text_batch(text_contents)

                batch_ids = []
                batch_embeddings = []
                batch_metadatas = []
                batch_documents = []

                for f, text, emb in zip(valid_text_files, text_contents, embeddings):
                    doc_id = file_hashes[f]
                    metadata = {
                        "file_path": str(f),
                        "file_name": f.name,
                        "file_type": utils.mime_type(f),
                        "media_category": "text",
                        "timestamp": utils.now_iso(),
                        "source": source,
                        "description": "",
                        "file_size": f.stat().st_size,
                    }
                    batch_ids.append(doc_id)
                    batch_embeddings.append(emb)
                    batch_metadatas.append(metadata)
                    batch_documents.append(text[:500])
                    results_map[f] = {"status": "embedded", "id": doc_id, "path": str(f), "category": "text"}

                store.add_many(batch_ids, batch_embeddings, batch_metadatas, batch_documents)
            except Exception as e:
                # If batch embedding fails, we mark all as error
                for f in valid_text_files:
                    results_map[f] = {"status": "error", "path": str(f), "error": f"Batch embedding failed: {str(e)}"}

    # 4. Process other categories individually (as they don't have batch embedding yet)
    for category, files_list in by_category.items():
        if category == "text":
            continue

        for f in files_list:
            try:
                doc_id = file_hashes[f]
                description = ""

                if category == "image":
                    embedding = embedder.embed_image(f)
                    doc_text = f"Image: {f.name}"
                elif category == "audio":
                    embedding = embedder.embed_audio(f)
                    doc_text = f"Audio: {f.name}"
                elif category == "video":
                    embedding = embedder.embed_video(f)
                    doc_text = f"Video: {f.name}"
                elif category == "document":
                    embedding = embedder.embed_pdf(f)
                    doc_text = f"PDF: {f.name}"
                else:
                    results_map[f] = {"status": "error", "path": str(f), "error": f"Unknown category: {category}"}
                    continue

                metadata = {
                    "file_path": str(f),
                    "file_name": f.name,
                    "file_type": utils.mime_type(f),
                    "media_category": category,
                    "timestamp": utils.now_iso(),
                    "source": source,
                    "description": description,
                    "file_size": f.stat().st_size,
                }
                store.add(doc_id, embedding, metadata, document=doc_text)
                results_map[f] = {"status": "embedded", "id": doc_id, "path": str(f), "category": category}
            except Exception as e:
                results_map[f] = {"status": "error", "path": str(f), "error": str(e)}

    # 5. Report results in original order for this batch
    batch_results = []
    for j, f in enumerate(files):
        res = results_map.get(f, {"status": "error", "path": str(f), "error": "Unknown error during batch processing"})
        batch_results.append(res)
        if progress_callback:
            progress_callback(start_index + j, total, res)

    return batch_results
