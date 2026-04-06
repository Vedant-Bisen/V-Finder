import sys
from unittest.mock import MagicMock

# Mock dependencies before they are imported by vector_embedded_finder
mock_genai = MagicMock()
sys.modules["google"] = MagicMock()
sys.modules["google.genai"] = mock_genai
sys.modules["chromadb"] = MagicMock()

from unittest.mock import patch
from vector_embedded_finder import store

def test_search_empty_collection():
    mock_coll = MagicMock()
    mock_coll.count.return_value = 0

    with patch("vector_embedded_finder.store._get_collection", return_value=mock_coll):
        query_embedding = [0.1, 0.2, 0.3]
        result = store.search(query_embedding)

        # Verify the expected empty structure
        assert result == {"ids": [[]], "metadatas": [[]], "documents": [[]], "distances": [[]]}

        # Verify that coll.query was NOT called
        mock_coll.query.assert_not_called()

        # Verify count was called
        assert mock_coll.count.called

def test_search_not_empty_collection():
    mock_coll = MagicMock()
    mock_coll.count.return_value = 10
    mock_coll.query.return_value = {
        "ids": [["doc1"]],
        "metadatas": [[{"key": "val"}]],
        "documents": [["content"]],
        "distances": [[0.1]]
    }

    with patch("vector_embedded_finder.store._get_collection", return_value=mock_coll):
        query_embedding = [0.1, 0.2, 0.3]
        result = store.search(query_embedding, n_results=5)

        # Verify the results are from query()
        assert result["ids"] == [["doc1"]]

        # Verify that coll.query WAS called with correct arguments
        mock_coll.query.assert_called_once()
        kwargs = mock_coll.query.call_args.kwargs
        assert kwargs["query_embeddings"] == [[0.1, 0.2, 0.3]]
        assert kwargs["n_results"] == 5
        assert "include" in kwargs
