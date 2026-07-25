"""Tests for backend.app.jobs.manager — JobManager offline mode methods."""

import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "testsecretkeytestsecretkeytestsecretkey")
os.environ.setdefault("JWT_REFRESH_SECRET_KEY", "testrefreshsecretkeytestrefreshsecretkey")
os.environ.setdefault("ENV", "testing")

from unittest.mock import MagicMock, patch

import pytest

from backend.app.cache.cache_service import cache_service
from backend.app.jobs.manager import JobManager


class TestJobManagerOffline:
    """Test JobManager when cache service is disabled."""

    def test_get_job_key(self):
        key = JobManager._get_job_key("abc-123")
        assert key == "snowpulse:job_tracker:abc-123"

    def test_update_progress_disabled(self):
        """update_progress should be a no-op when cache is disabled."""
        original_enabled = cache_service.enabled
        original_client = cache_service.client
        cache_service.enabled = False
        cache_service.client = None
        try:
            JobManager.update_progress("job-1", 50, "half done")
        finally:
            cache_service.enabled = original_enabled
            cache_service.client = original_client

    def test_mark_completed_disabled(self):
        original_enabled = cache_service.enabled
        original_client = cache_service.client
        cache_service.enabled = False
        cache_service.client = None
        try:
            JobManager.mark_completed("job-1", {"result": "ok"})
        finally:
            cache_service.enabled = original_enabled
            cache_service.client = original_client

    def test_mark_failed_disabled(self):
        original_enabled = cache_service.enabled
        original_client = cache_service.client
        cache_service.enabled = False
        cache_service.client = None
        try:
            JobManager.mark_failed("job-1", "some error")
        finally:
            cache_service.enabled = original_enabled
            cache_service.client = original_client

    def test_get_job_status_disabled(self):
        original_enabled = cache_service.enabled
        original_client = cache_service.client
        cache_service.enabled = False
        cache_service.client = None
        try:
            result = JobManager.get_job_status("job-1")
            assert result["status"] == "unknown"
        finally:
            cache_service.enabled = original_enabled
            cache_service.client = original_client

    def test_get_all_jobs_status_disabled(self):
        original_enabled = cache_service.enabled
        original_client = cache_service.client
        cache_service.enabled = False
        cache_service.client = None
        try:
            result = JobManager.get_all_jobs_status()
            assert result == []
        finally:
            cache_service.enabled = original_enabled
            cache_service.client = original_client


class TestJobManagerWithMockRedis:
    """Test JobManager with a mocked Redis client."""

    def _setup_mock_cache(self):
        mock_client = MagicMock()
        original_enabled = cache_service.enabled
        original_client = cache_service.client
        cache_service.enabled = True
        cache_service.client = mock_client
        return mock_client, original_enabled, original_client

    def _restore_cache(self, original_enabled, original_client):
        cache_service.enabled = original_enabled
        cache_service.client = original_client

    def test_update_progress_with_redis(self):
        mock_client, orig_e, orig_c = self._setup_mock_cache()
        mock_client.exists.return_value = True
        try:
            JobManager.update_progress("job-99", 75, "Almost done")
            mock_client.hset.assert_called_once()
        finally:
            self._restore_cache(orig_e, orig_c)

    def test_mark_completed_with_redis(self):
        mock_client, orig_e, orig_c = self._setup_mock_cache()
        try:
            JobManager.mark_completed("job-99", {"status": "success"})
            mock_client.hset.assert_called_once()
        finally:
            self._restore_cache(orig_e, orig_c)

    def test_mark_failed_with_redis(self):
        mock_client, orig_e, orig_c = self._setup_mock_cache()
        mock_client.time.return_value = (1234567890, 0)
        try:
            JobManager.mark_failed("job-99", "Timeout error")
            assert mock_client.hset.call_count == 1
            mock_client.lpush.assert_called_once()
        finally:
            self._restore_cache(orig_e, orig_c)

    def test_get_job_status_found(self):
        mock_client, orig_e, orig_c = self._setup_mock_cache()
        mock_client.hgetall.return_value = {
            "job_id": "job-99",
            "status": "running",
            "progress": "50",
            "message": "Processing",
            "result": "",
        }
        try:
            result = JobManager.get_job_status("job-99")
            assert result["status"] == "running"
            assert result["progress"] == 50
        finally:
            self._restore_cache(orig_e, orig_c)

    def test_get_job_status_not_found(self):
        mock_client, orig_e, orig_c = self._setup_mock_cache()
        mock_client.hgetall.return_value = {}
        try:
            result = JobManager.get_job_status("job-missing")
            assert result["status"] == "not_found"
        finally:
            self._restore_cache(orig_e, orig_c)

    def test_get_job_status_with_result(self):
        mock_client, orig_e, orig_c = self._setup_mock_cache()
        mock_client.hgetall.return_value = {
            "job_id": "job-99",
            "status": "completed",
            "progress": "100",
            "result": '{"answer": 42}',
        }
        try:
            result = JobManager.get_job_status("job-99")
            assert result["result"] == {"answer": 42}
        finally:
            self._restore_cache(orig_e, orig_c)

    def test_get_all_jobs_status_with_data(self):
        mock_client, orig_e, orig_c = self._setup_mock_cache()
        mock_client.keys.return_value = ["snowpulse:job_tracker:a", "snowpulse:job_tracker:b"]
        mock_client.hgetall.side_effect = [
            {"job_id": "a", "status": "completed", "progress": "100", "result": ""},
            {"job_id": "b", "status": "running", "progress": "30", "result": ""},
        ]
        try:
            result = JobManager.get_all_jobs_status()
            assert len(result) == 2
            assert result[0]["progress"] == 100
        finally:
            self._restore_cache(orig_e, orig_c)

    @pytest.mark.asyncio
    async def test_create_job_tracker(self):
        mock_client, orig_e, orig_c = self._setup_mock_cache()
        try:
            await JobManager.create_job_tracker("job-new", "test_task", "default")
            mock_client.hset.assert_called_once()
            mock_client.expire.assert_called_once()
        finally:
            self._restore_cache(orig_e, orig_c)
