from unittest.mock import MagicMock

from app.search.service import SearchService


def test_search_service_disabled():
    ss = SearchService()
    ss.enabled = False
    ss.client = None

    ss.index_document("dataset", {"id": 1})
    ss.delete_document("dataset", "1")
    res = ss.search("query")
    assert res["hits"] == []
    reindex = ss.reindex_all_resources(MagicMock())
    assert reindex["indexed"] == 0


def test_search_service_enabled_mock():
    ss = SearchService()
    mock_client = MagicMock()
    ss.client = mock_client
    ss.enabled = True

    # Test bootstrap
    ss.bootstrap_indices()
    mock_client.create_index.assert_called_with("snowpulse_resources", {"primaryKey": "id"})

    # Test index_document
    ss.index_document("dataset", {"id": 1, "title": "Test Dataset"})
    mock_index = mock_client.index.return_value
    mock_index.add_documents.assert_called()

    # Test delete_document
    ss.delete_document("dataset", "1")
    mock_index.delete_document.assert_called_with("dataset_1")

    # Test search
    mock_index.search.return_value = {"hits": [{"id": "dataset_1"}]}
    res = ss.search("test", user_id=1, resource_type="dataset")
    assert len(res["hits"]) == 1

    # Test reindex_all_resources
    mock_db = MagicMock()
    mock_db.query.return_value.all.return_value = []
    res_reindex = ss.reindex_all_resources(mock_db)
    assert res_reindex["indexed"] == 0
