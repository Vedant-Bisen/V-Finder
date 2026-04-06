import pytest
from vector_embedded_finder import config, store, utils
from pathlib import Path

def test_config_paths():
    assert config.SETTINGS_DIR.exists()
    assert config.DATA_DIR.exists()

def test_media_category():
    assert config.get_media_category(".png") == "image"
    assert config.get_media_category(".mp3") == "audio"
    assert config.get_media_category(".mp4") == "video"
    assert config.get_media_category(".pdf") == "document"
    assert config.get_media_category(".txt") == "text"
    assert config.get_media_category(".unknown") is None

def test_utils_supported():
    assert utils.is_supported(Path("test.png"))
    assert utils.is_supported(Path("test.txt"))
    assert not utils.is_supported(Path("test.exe"))

def test_store_operations():
    # Basic smoke test for store (assuming mock or local chroma)
    count = store.count()
    assert isinstance(count, int)
