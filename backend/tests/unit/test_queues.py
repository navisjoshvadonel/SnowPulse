"""Tests for backend.app.queues.connection — Redis settings parser."""

import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "testsecretkeytestsecretkeytestsecretkey")
os.environ.setdefault("JWT_REFRESH_SECRET_KEY", "testrefreshsecretkeytestrefreshsecretkey")
os.environ.setdefault("ENV", "testing")

from unittest.mock import patch

from backend.app.queues.connection import get_redis_settings


def test_get_redis_settings_default():
    settings = get_redis_settings()
    assert settings.host is not None
    assert settings.port > 0


def test_get_redis_settings_custom_url():
    with patch("backend.app.queues.connection.REDIS_URL", "redis://myhost:6380/2"):
        settings = get_redis_settings()
        assert settings.host == "myhost"
        assert settings.port == 6380
        assert settings.database == 2


def test_get_redis_settings_with_password():
    with patch("backend.app.queues.connection.REDIS_URL", "redis://:mysecret@redishost:6379/1"):
        settings = get_redis_settings()
        assert settings.host == "redishost"
        assert settings.password == "mysecret"
        assert settings.database == 1
