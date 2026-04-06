import hashlib
from pathlib import Path
from datetime import datetime
from vector_embedded_finder.utils import text_hash, file_hash, mime_type, now_iso, is_supported, file_size_mb
import pytest

def test_text_hash():
    text = "hello world"
    expected = hashlib.sha256(text.encode()).hexdigest()
    assert text_hash(text) == expected

    # Test empty string
    assert text_hash("") == hashlib.sha256(b"").hexdigest()

    # Test unicode
    unicode_text = "👋 hello"
    assert text_hash(unicode_text) == hashlib.sha256(unicode_text.encode()).hexdigest()

def test_file_hash(tmp_path):
    d = tmp_path / "subdir"
    d.mkdir()
    p = d / "hello.txt"
    content = b"hello world content"
    p.write_bytes(content)

    expected = hashlib.sha256(content).hexdigest()
    assert file_hash(p) == expected

def test_mime_type():
    assert mime_type(Path("test.jpg")) == "image/jpeg"
    assert mime_type(Path("test.png")) == "image/png"
    assert mime_type(Path("test.txt")) == "text/plain"
    assert mime_type(Path("test.unknown_extension")) == "application/octet-stream"

def test_now_iso():
    iso_str = now_iso()
    # Check if it's a valid ISO format by trying to parse it
    dt = datetime.fromisoformat(iso_str)
    assert dt.tzinfo is not None # Should have timezone info (UTC)

def test_is_supported():
    assert is_supported(Path("test.jpg")) is True
    assert is_supported(Path("test.txt")) is True
    assert is_supported(Path("test.unknown")) is False
    assert is_supported(Path("._test.jpg")) is False # macOS resource fork

def test_file_size_mb(tmp_path):
    p = tmp_path / "large_file.bin"
    # 1MB is 1024 * 1024 bytes
    p.write_bytes(b"\0" * (1024 * 1024))
    assert file_size_mb(p) == 1.0

    p2 = tmp_path / "half_mb.bin"
    p2.write_bytes(b"\0" * (512 * 1024))
    assert file_size_mb(p2) == 0.5
