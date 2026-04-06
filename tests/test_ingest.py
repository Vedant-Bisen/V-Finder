import pytest
from pathlib import Path
from vector_embedded_finder.ingest import ingest_file

def test_ingest_file_not_found():
    """Test that FileNotFoundError is raised when the file does not exist."""
    non_existent_path = Path("non_existent_file.txt")
    with pytest.raises(FileNotFoundError, match="File not found"):
        ingest_file(non_existent_path)

def test_ingest_unsupported_file_type(tmp_path):
    """Test that ValueError is raised for an unsupported file extension."""
    unsupported_file = tmp_path / "test.unsupported_ext"
    unsupported_file.write_text("some content")

    with pytest.raises(ValueError, match="Unsupported file type: .unsupported_ext"):
        ingest_file(unsupported_file)

def test_ingest_mac_resource_fork_unsupported(tmp_path):
    """Test that macOS resource fork files (._filename) are treated as unsupported."""
    resource_fork = tmp_path / "._test.txt"
    resource_fork.write_text("some content")

    # utils.is_supported returns False for ._ prefix
    with pytest.raises(ValueError, match="Unsupported file type: .txt"):
        ingest_file(resource_fork)
