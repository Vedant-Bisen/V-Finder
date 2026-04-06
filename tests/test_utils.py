import pytest
from pathlib import Path
from vector_embedded_finder.utils import is_supported
from vector_embedded_finder import config

def test_is_supported_macos_resource_forks():
    """Test that macOS resource fork files (starting with ._) are rejected."""
    assert is_supported(Path("._image.jpg")) is False
    assert is_supported(Path("._document.pdf")) is False
    assert is_supported(Path("path/to/._secret.txt")) is False

def test_is_supported_valid_extensions():
    """Test that files with supported extensions are accepted."""
    assert is_supported(Path("image.jpg")) is True
    assert is_supported(Path("document.pdf")) is True
    assert is_supported(Path("script.py")) is True
    assert is_supported(Path("data.json")) is True

def test_is_supported_unsupported_extensions():
    """Test that files with unsupported extensions are rejected."""
    assert is_supported(Path("binary.exe")) is False
    assert is_supported(Path("archive.zip")) is False
    assert is_supported(Path("disk.dmg")) is False

def test_is_supported_case_insensitivity():
    """Test that extensions are handled case-insensitively."""
    assert is_supported(Path("IMAGE.JPG")) is True
    assert is_supported(Path("Document.PDF")) is True
    assert is_supported(Path("SCRIPT.PY")) is True

def test_is_supported_hidden_files_non_resource_fork():
    """Test that hidden files (starting with .) that are not resource forks are handled based on extension."""
    # .gitignore has name ".gitignore" and suffix ""
    assert is_supported(Path(".gitignore")) is False

    # If someone has a hidden file with a supported extension that isn't a resource fork
    # (Though usually hidden files don't have these extensions, we should test the logic)
    # Actually, .bashrc etc don't have supported suffixes in config.py

    # What if a file is named .test.py?
    assert is_supported(Path(".test.py")) is True

def test_is_supported_no_extension():
    """Test that files with no extension are rejected."""
    assert is_supported(Path("README")) is False
    assert is_supported(Path("LICENSE")) is False

def test_is_supported_multiple_dots():
    """Test files with multiple dots."""
    assert is_supported(Path("archive.tar.gz")) is False # .gz is not in ALL_EXTENSIONS
    assert is_supported(Path("my.image.jpg")) is True
