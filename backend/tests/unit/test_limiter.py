"""Tests for backend.app.limiter — rate limiting key function."""

import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "testsecretkeytestsecretkeytestsecretkey")
os.environ.setdefault("JWT_REFRESH_SECRET_KEY", "testrefreshsecretkeytestrefreshsecretkey")
os.environ.setdefault("ENV", "testing")

from unittest.mock import MagicMock

from backend.app.limiter import limiter, user_or_ip_identifier


def _make_request(auth_header=None, client_host="127.0.0.1"):
    """Build a minimal mock request."""
    request = MagicMock()
    headers = {}
    if auth_header:
        headers["Authorization"] = auth_header
    request.headers = headers
    request.client = MagicMock()
    request.client.host = client_host
    # slowapi's get_remote_address reads request.client.host
    return request


def test_user_or_ip_identifier_with_bearer_token():
    request = _make_request(auth_header="Bearer my-jwt-token-123")
    result = user_or_ip_identifier(request)
    assert result == "user:my-jwt-token-123"


def test_user_or_ip_identifier_without_auth():
    request = _make_request(client_host="192.168.1.50")
    result = user_or_ip_identifier(request)
    # Should fall back to remote address
    assert "192.168.1.50" in result


def test_user_or_ip_identifier_with_non_bearer_auth():
    request = _make_request(auth_header="Basic dXNlcjpwYXNz")
    result = user_or_ip_identifier(request)
    # Non-bearer auth should fall back to IP
    assert "user:" not in result


def test_limiter_instance_exists():
    assert limiter is not None
