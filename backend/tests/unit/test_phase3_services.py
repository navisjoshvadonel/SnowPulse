import os
from unittest.mock import AsyncMock, MagicMock, patch

import pandas as pd
import pytest

from app.cache.cache_service import cache_service
from app.jobs.manager import JobManager
from app.ml.features import FeaturePipeline
from app.search.service import SearchService
from app.storage.service import StorageService
from app.validation.quality.quality_scorer import DataQualityScorer


# 1. Test MinIO Storage Wrapper
@patch("app.storage.service.Minio")
def test_storage_service_init_and_operations(mock_minio_class):
    mock_client = MagicMock()
    mock_minio_class.return_value = mock_client

    # We patch env vars and instantiate the storage service
    with patch.dict(os.environ, {
        "MINIO_ENDPOINT": "localhost:9000",
        "MINIO_ACCESS_KEY": "test",
        "MINIO_SECRET_KEY": "test"
    }):
        # Mock exists logic
        mock_client.bucket_exists.return_value = False

        service = StorageService()
        assert service.enabled is True

        # Test upload
        service.upload_file("test-bucket", "file.csv", b"data", "text/csv")
        mock_client.put_object.assert_called_once()

        # Test get file
        mock_response = MagicMock()
        mock_response.read.return_value = b"retrieved-data"
        mock_client.get_object.return_value = mock_response

        result = service.get_file("test-bucket", "file.csv")
        assert result == b"retrieved-data"

# 2. Test Meilisearch Search Wrapper
@patch("app.search.service.meilisearch.Client")
def test_search_service(mock_meili_client_class):
    mock_client = MagicMock()
    mock_meili_client_class.return_value = mock_client

    with patch.dict(os.environ, {
        "MEILI_HOST": "http://localhost:7700",
        "MEILI_MASTER_KEY": "test"
    }):
        service = SearchService()
        assert service.enabled is True

        # Test document indexing
        service.index_document("dataset", {"id": 1, "name": "sales"})
        mock_client.index.assert_called_with("snowpulse_resources")

        # Test search
        mock_index = MagicMock()
        mock_client.index.return_value = mock_index
        mock_index.search.return_value = {"hits": [{"id": 1}], "nbHits": 1}

        res = service.search("sales")
        assert len(res["hits"]) == 1

# 3. Test Data Quality validation scoring
def test_data_quality_scorer():
    # Construct standard valid transaction CSV
    data = (
        "Date,Revenue,Category,Region\n"
        "2026-06-01,100.5,A,North\n"
        "2026-06-02,200.0,B,South\n"
        "2026-06-03,,A,North\n" # One null revenue
        "2026-06-04,150.2,B,East\n"
    )
    file_bytes = data.encode("utf-8")

    is_valid, report = DataQualityScorer.validate_and_score(file_bytes, "sales.csv")

    assert is_valid is True # Non-critical nulls allow validation to pass
    assert report["quality_score"] > 50
    assert report["total_records"] == 4
    assert report["missing_values_count"] == 1

# 4. Test ML Feature Pipeline
def test_feature_pipeline():
    df = pd.DataFrame({
        "num1": [1.0, 2.0, 3.0, 4.0],
        "cat1": ["X", "Y", "X", "Y"]
    })

    pipeline = FeaturePipeline()
    scaled = pipeline.fit_transform_numeric(df, ["num1"])
    assert scaled.shape == (4, 1)

    encoded = pipeline.fit_transform_categorical(df, ["cat1"])
    assert encoded.shape == (4, 1)
    # Check that Y is transformed consistently
    assert encoded[1, 0] != encoded[0, 0]

# 5. Test Job Manager Task queue mock
@pytest.mark.asyncio
@patch("app.jobs.manager.get_redis_pool")
async def test_job_manager_submission(mock_get_redis_pool):
    mock_arq_redis = AsyncMock()
    mock_get_redis_pool.return_value = mock_arq_redis

    # Mock cache_service to be active
    mock_redis_client = MagicMock()
    cache_service.enabled = True
    cache_service.client = mock_redis_client

    # Run progress update test
    mock_redis_client.exists.return_value = True
    JobManager.update_progress("job123", 45, "Running task...")
    mock_redis_client.hset.assert_called_with(
        "snowpulse:job_tracker:job123",
        mapping={"progress": 45, "message": "Running task...", "status": "running"}
    )

    # Run job submission test
    job_id = await JobManager.submit_job("process_pipeline_task", 1, "key", "file.csv")
    assert job_id is not None
    mock_arq_redis.enqueue_job.assert_called_once()
