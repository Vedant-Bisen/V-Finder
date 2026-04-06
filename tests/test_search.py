from vector_embedded_finder.search import format_results

def test_format_results_empty():
    assert format_results([]) == "No results found."

def test_format_results_single_full_metadata():
    results = [{
        "id": "1",
        "similarity": 0.95,
        "file_path": "/path/to/file.jpg",
        "file_name": "file.jpg",
        "media_category": "image",
        "timestamp": "2023-10-27T10:00:00",
        "description": "A beautiful sunset",
        "source": "camera",
        "preview": "This is a preview of the image content."
    }]
    formatted = format_results(results)
    assert "**1. [image] file.jpg** — 95.0% match" in formatted
    assert "Path: `/path/to/file.jpg`" in formatted
    assert "Date: 2023-10-27 | Source: camera" in formatted
    assert "Preview: This is a preview of the image content." in formatted
    assert "Description: A beautiful sunset" in formatted

def test_format_results_missing_metadata():
    results = [{
        "id": "2",
        "similarity": 0.8,
        "file_path": "",
        "file_name": "",
        "media_category": "text",
        "timestamp": "",
        "description": "",
        "source": "manual",
        "preview": "Small preview"
    }]
    formatted = format_results(results)
    assert "**1. [text] text** — 80.0% match" in formatted
    assert "(text snippet)" in formatted
    assert "Date: unknown | Source: manual" in formatted
    assert "Preview: Small preview" in formatted
    assert "Description:" not in formatted

def test_format_results_multiple_results():
    results = [
        {
            "id": "1",
            "similarity": 0.9,
            "file_path": "a.txt",
            "file_name": "a.txt",
            "media_category": "text",
            "timestamp": "2023-01-01",
            "description": "First",
            "source": "s1",
            "preview": "p1"
        },
        {
            "id": "2",
            "similarity": 0.7,
            "file_path": "b.txt",
            "file_name": "b.txt",
            "media_category": "text",
            "timestamp": "2023-01-02",
            "description": "Second",
            "source": "s2",
            "preview": "p2"
        }
    ]
    formatted = format_results(results)
    assert "**1. [text] a.txt**" in formatted
    assert "**2. [text] b.txt**" in formatted
    assert "90.0% match" in formatted
    assert "70.0% match" in formatted

def test_format_results_similarity_boundaries():
    results = [
        {"id": "1", "similarity": 1.0, "file_path": "", "file_name": "", "media_category": "t", "timestamp": "", "description": "", "source": "s", "preview": ""},
        {"id": "2", "similarity": 0.0, "file_path": "", "file_name": "", "media_category": "t", "timestamp": "", "description": "", "source": "s", "preview": ""}
    ]
    formatted = format_results(results)
    assert "100.0% match" in formatted
    assert "0.0% match" in formatted

def test_format_results_preview_newline_replacement():
    results = [{
        "id": "1",
        "similarity": 0.5,
        "file_path": "f.txt",
        "file_name": "f.txt",
        "media_category": "text",
        "timestamp": "",
        "description": "",
        "source": "s",
        "preview": "line one\nline two"
    }]
    formatted = format_results(results)
    assert "Preview: line one line two" in formatted

def test_format_results_missing_similarity():
    results = [{
        "id": "1",
        "file_path": "",
        "file_name": "",
        "media_category": "text",
        "timestamp": "",
        "description": "",
        "source": "manual",
        "preview": ""
    }]
    formatted = format_results(results)
    assert "0.0% match" in formatted
