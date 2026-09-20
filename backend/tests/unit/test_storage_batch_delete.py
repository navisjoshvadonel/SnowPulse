import io
import time
from unittest.mock import MagicMock, patch

import pytest
from app.storage.service import StorageService
from minio.deleteobjects import DeleteError
from minio.error import S3Error


@patch("app.storage.service.Minio")
def test_storage_service_batch_delete_minio(mock_minio_class):
    mock_client = MagicMock()
    mock_minio_class.return_value = mock_client
    mock_client.bucket_exists.return_value = True
    mock_client.remove_objects.return_value = []  # No errors

    service = StorageService()
    assert service.enabled is True

    filenames = [f"report_{i}.pdf" for i in range(10)]
    service.delete_files("reports", filenames)

    mock_client.remove_objects.assert_called_once()
    args, _ = mock_client.remove_objects.call_args
    assert args[0] == "reports"
    delete_obj_list = args[1]
    assert len(delete_obj_list) == 10
    assert delete_obj_list[0]._name == "report_0.pdf"


@patch("app.storage.service.Minio")
def test_storage_service_batch_delete_minio_with_errors(mock_minio_class):
    mock_client = MagicMock()
    mock_minio_class.return_value = mock_client
    mock_client.bucket_exists.return_value = True

    err1 = DeleteError("report_0.pdf", None, "Access Denied", "403")
    mock_client.remove_objects.return_value = [err1]

    service = StorageService()
    filenames = ["report_0.pdf"]
    service.delete_files("reports", filenames)
    mock_client.remove_objects.assert_called_once()


@patch("app.storage.service.Minio")
def test_storage_service_batch_delete_minio_exception_fallback(mock_minio_class, tmp_path):
    mock_client = MagicMock()
    mock_minio_class.return_value = mock_client
    mock_client.bucket_exists.return_value = True
    mock_client.remove_objects.side_effect = Exception("MinIO offline")

    service = StorageService()
    service.local_dir = str(tmp_path)

    bucket_dir = tmp_path / "reports"
    bucket_dir.mkdir(parents=True, exist_ok=True)
    (bucket_dir / "report_0.pdf").write_bytes(b"content")

    service.delete_files("reports", ["report_0.pdf"])
    assert not (bucket_dir / "report_0.pdf").exists()


def test_storage_service_batch_delete_empty_list():
    service = StorageService()
    service.delete_files("reports", [])


def test_storage_service_batch_delete_local_fallback(tmp_path):
    service = StorageService()
    service.enabled = False
    service.client = None
    service.local_dir = str(tmp_path)

    bucket_dir = tmp_path / "reports"
    bucket_dir.mkdir(parents=True, exist_ok=True)

    filenames = []
    for i in range(5):
        fn = f"report_{i}.pdf"
        file_path = bucket_dir / fn
        file_path.write_bytes(b"content")
        filenames.append(fn)

    # Confirm files created
    for fn in filenames:
        assert (bucket_dir / fn).exists()

    service.delete_files("reports", filenames)

    # Confirm all files deleted
    for fn in filenames:
        assert not (bucket_dir / fn).exists()


@patch("app.storage.service.Minio")
def test_storage_service_upload_file_stream_and_metadata(mock_minio_class):
    mock_client = MagicMock()
    mock_minio_class.return_value = mock_client
    mock_client.bucket_exists.return_value = True

    service = StorageService()
    data_stream = io.BytesIO(b"stream content")
    result = service.upload_file("datasets", "test.csv", data_stream, metadata={"author": "alice"})
    assert result == "minio://datasets/test.csv"
    mock_client.put_object.assert_called_once()


@patch("app.storage.service.Minio")
def test_storage_service_upload_fallback_disk(mock_minio_class, tmp_path):
    mock_client = MagicMock()
    mock_minio_class.return_value = mock_client
    mock_client.put_object.side_effect = Exception("Upload error")

    service = StorageService()
    service.local_dir = str(tmp_path)

    res = service.upload_file("datasets", "fallback.csv", b"data")
    assert str(tmp_path) in res
    assert (tmp_path / "datasets" / "fallback.csv").read_bytes() == b"data"


def test_storage_service_get_file_fallback_and_not_found(tmp_path):
    service = StorageService()
    service.enabled = False
    service.local_dir = str(tmp_path)

    file_dir = tmp_path / "datasets"
    file_dir.mkdir(parents=True, exist_ok=True)
    (file_dir / "data.csv").write_bytes(b"hello world")

    # Found in local dir
    content = service.get_file("datasets", "data.csv")
    assert content == b"hello world"

    # Not found raises RuntimeError
    with pytest.raises(RuntimeError, match="File not found"):
        service.get_file("datasets", "nonexistent.csv")


def test_storage_service_get_signed_url_offline():
    service = StorageService()
    service.enabled = False
    with pytest.raises(RuntimeError, match="Storage service is offline"):
        service.get_signed_url("datasets", "data.csv")


@patch("app.storage.service.Minio")
def test_storage_service_get_signed_url_s3error(mock_minio_class):
    mock_client = MagicMock()
    mock_minio_class.return_value = mock_client
    mock_client.presigned_get_object.side_effect = S3Error("code", "msg", "res", "req", "host", "bucket")

    service = StorageService()
    with pytest.raises(RuntimeError, match="URL generation failed"):
        service.get_signed_url("datasets", "data.csv")


@patch("app.storage.service.Minio")
def test_storage_service_delete_single_file_minio_and_fallback(mock_minio_class, tmp_path):
    mock_client = MagicMock()
    mock_minio_class.return_value = mock_client

    service = StorageService()
    service.delete_file("reports", "rep1.pdf")
    mock_client.remove_object.assert_called_once_with("reports", "rep1.pdf")

    # Fallback when offline
    service.enabled = False
    service.client = None
    service.local_dir = str(tmp_path)
    file_path = tmp_path / "reports" / "rep1.pdf"
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_bytes(b"content")

    service.delete_file("reports", "rep1.pdf")
    assert not file_path.exists()


def test_storage_batch_delete_benchmark():
    """
    Benchmark comparing N individual delete calls vs 1 batch delete call.
    """
    mock_client = MagicMock()
    # Simulate realistic network latency for S3/MinIO API roundtrips (e.g. 5ms per HTTP call)
    network_latency_sec = 0.005

    def mock_remove_object(bucket, obj):
        time.sleep(network_latency_sec)

    def mock_remove_objects(bucket, obj_list):
        time.sleep(network_latency_sec)
        return []

    mock_client.remove_object.side_effect = mock_remove_object
    mock_client.remove_objects.side_effect = mock_remove_objects

    with patch("app.storage.service.Minio", return_value=mock_client):
        service = StorageService()
        service.enabled = True
        service.client = mock_client

        num_files = 50
        filenames = [f"report_{i}.pdf" for i in range(num_files)]

        # Benchmark N single calls (Baseline)
        start_single = time.perf_counter()
        for fn in filenames:
            service.delete_file("reports", fn)
        duration_single = time.perf_counter() - start_single

        # Benchmark 1 batch call (Optimized)
        start_batch = time.perf_counter()
        service.delete_files("reports", filenames)
        duration_batch = time.perf_counter() - start_batch

        speedup = duration_single / duration_batch if duration_batch > 0 else float("inf")
        print(f"\n[Benchmark] Deleting {num_files} objects:")
        print(f"  - Baseline (N single delete_file calls): {duration_single * 1000:.2f} ms")
        print(f"  - Optimized (1 batch delete_files call): {duration_batch * 1000:.2f} ms")
        print(f"  - Speedup: {speedup:.2f}x faster")

        assert duration_batch < duration_single
