"""Tests for backend.app.cache.cache_service — CacheService offline mode."""

import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "testsecretkeytestsecretkeytestsecretkey")
os.environ.setdefault("JWT_REFRESH_SECRET_KEY", "testrefreshsecretkeytestrefreshsecretkey")
os.environ.setdefault("ENV", "testing")

import pytest

from backend.app.cache.cache_service import CacheService


class TestCacheServiceOffline:
    """Test CacheService in offline/disabled mode (no Redis available)."""

    def _make_disabled_service(self):
        """Create a CacheService instance with caching disabled."""
        svc = CacheService.__new__(CacheService)
        svc.client = None
        svc.enabled = False
        return svc

    def test_get_returns_none_when_disabled(self):
        svc = self._make_disabled_service()
        assert svc.get("any_key") is None

    def test_set_returns_false_when_disabled(self):
        svc = self._make_disabled_service()
        assert svc.set("key", {"data": 1}, ttl_seconds=60) is False

    def test_invalidate_returns_false_when_disabled(self):
        svc = self._make_disabled_service()
        assert svc.invalidate("key") is False

    def test_invalidate_pattern_returns_false_when_disabled(self):
        svc = self._make_disabled_service()
        assert svc.invalidate_pattern("*") is False

    def test_get_key_format(self):
        svc = self._make_disabled_service()
        key = svc._get_key("test_key")
        assert "snowpulse" in key
        assert "test_key" in key
