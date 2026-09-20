import time
from unittest.mock import MagicMock, patch

from app.storage.service import StorageService


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
