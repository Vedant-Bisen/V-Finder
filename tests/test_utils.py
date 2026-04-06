import hashlib
import pytest
from pathlib import Path
from datetime import datetime
from vector_embedded_finder.utils import (
    text_hash,
    file_hash,
    mime_type,
    now_iso,
    is_supported,
    file_size_mb
)

def test_text_hash_basic():
    """Test text_hash with a simple string."""
    text = "hello"
    expected = hashlib.sha256(text.encode()).hexdigest()
    assert text_hash(text) == expected

def test_text_hash_empty():
    """Test text_hash with an empty string."""
    assert text_hash("") == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

def test_text_hash_unicode():
    """Test text_hash with unicode characters."""
    text = "🚀 vfinder"
    expected = hashlib.sha256(text.encode()).hexdigest()
    assert text_hash(text) == expected

def test_file_hash_basic(tmp_path):
    """Test file_hash with a simple file."""
    content = b"hello world"
    file = tmp_path / "test.txt"
    file.write_bytes(content)

    expected = hashlib.sha256(content).hexdigest()
    assert file_hash(file) == expected

def test_file_hash_empty(tmp_path):
    """Test file_hash with an empty file."""
    file = tmp_path / "empty.txt"
    file.touch()

    assert file_hash(file) == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

def test_file_hash_large(tmp_path):
    """Test file_hash with a file larger than the 8192 byte chunk size."""
    # 10,000 bytes of data
    content = b"A" * 10000
    file = tmp_path / "large.txt"
    file.write_bytes(content)

    expected = hashlib.sha256(content).hexdigest()
    assert file_hash(file) == expected

def test_file_hash_non_existent():
    """Test file_hash raises FileNotFoundError for missing files."""
    with pytest.raises(FileNotFoundError):
        file_hash(Path("non_existent_file_xyz.txt"))

def test_mime_type_common():
    """Test mime_type for common extensions."""
    assert mime_type(Path("test.jpg")) == "image/jpeg"
    assert mime_type(Path("test.png")) == "image/png"
    assert mime_type(Path("test.pdf")) == "application/pdf"
    assert mime_type(Path("test.txt")) == "text/plain"

def test_mime_type_unknown():
    """Test mime_type for unknown extensions."""
    assert mime_type(Path("test.unknown_extension_xyz")) == "application/octet-stream"

def test_now_iso():
    """Test now_iso returns a valid ISO format string."""
    iso_str = now_iso()
    # Should not raise ValueError
    datetime.fromisoformat(iso_str)
    assert "T" in iso_str

def test_is_supported():
    """Test is_supported based on extension and filename."""
    assert is_supported(Path("image.jpg")) is True
    assert is_supported(Path("doc.pdf")) is True
    assert is_supported(Path("random.txt")) is True
    assert is_supported(Path("script.py")) is True
    # Resource fork
    assert is_supported(Path("._image.jpg")) is False
    # Unsupported extension
    assert is_supported(Path("program.exe")) is False
    assert is_supported(Path("data.bin")) is False

def test_file_size_mb(tmp_path):
    """Test file_size_mb calculation."""
    file = tmp_path / "size.bin"
    # 1 MB = 1024 * 1024 bytes
    file.write_bytes(b"0" * (1024 * 1024))
    assert file_size_mb(file) == 1.0

    file2 = tmp_path / "size2.bin"
    file2.write_bytes(b"0" * (512 * 1024))
    assert file_size_mb(file2) == 0.5
