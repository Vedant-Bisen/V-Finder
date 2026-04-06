import pytest
from pathlib import Path
from vector_embedded_finder.ingest import ingest_file

def test_ingest_file_not_found():
    """Test that ingest_file raises FileNotFoundError for non-existent paths."""
    fake_path = Path("non_existent_file_12345.txt")
    with pytest.raises(FileNotFoundError, match="File not found"):
        ingest_file(fake_path)

def test_ingest_unsupported_file_type(tmp_path):
    """Test that ingest_file raises ValueError for unsupported file extensions."""
    # Create a temporary file with an unsupported extension
    unsupported_file = tmp_path / "test.unsupported_extension"
    unsupported_file.write_text("dummy content")

    with pytest.raises(ValueError, match="Unsupported file type"):
        ingest_file(unsupported_file)
