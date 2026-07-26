import pytest
from unittest.mock import MagicMock
from app.cache.cache_service import CacheService


def test_cache_service_fallback_disabled():
    cs = CacheService()
    cs.enabled = False
    cs.client = None

    assert cs.get("key1") is None
    assert cs.set("key1", {"data": 123}, 60) is False
    assert cs.invalidate("key1") is False
    assert cs.invalidate_pattern("key*") is False


def test_cache_service_operations():
    cs = CacheService()
    mock_redis = MagicMock()
    cs.client = mock_redis
    cs.enabled = True

    # Test set
    res_set = cs.set("test_key", {"foo": "bar"}, 300)
    assert res_set is True
    mock_redis.set.assert_called_once()

    # Test get hit
    mock_redis.get.return_value = '{"foo": "bar"}'
    res_get = cs.get("test_key")
    assert res_get == {"foo": "bar"}

    # Test get miss
    mock_redis.get.return_value = None
    assert cs.get("missing_key") is None

    # Test invalidate
    assert cs.invalidate("test_key") is True
    mock_redis.delete.assert_called()

    # Test invalidate pattern
    mock_redis.keys.return_value = ["snowpulse:v1:pattern1", "snowpulse:v1:pattern2"]
    assert cs.invalidate_pattern("pattern*") is True
