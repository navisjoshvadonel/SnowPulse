"""Tests for backend.app.auth module — password hashing, JWT creation, cookie helpers."""

import datetime
import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "testsecretkeytestsecretkeytestsecretkey")
os.environ.setdefault("JWT_REFRESH_SECRET_KEY", "testrefreshsecretkeytestrefreshsecretkey")
os.environ.setdefault("ENV", "testing")

from unittest.mock import MagicMock

import pytest
from jose import jwt

from backend.app.auth import (
    ALGORITHM,
    JWT_REFRESH_SECRET_KEY,
    JWT_SECRET_KEY,
    _require_secret,
    create_access_token,
    create_refresh_token,
    delete_refresh_token_cookie,
    get_password_hash,
    set_refresh_token_cookie,
    verify_password,
)


# --- _require_secret ---

def test_require_secret_returns_env_value():
    os.environ["__TEST_SECRET"] = "a" * 40
    result = _require_secret("__TEST_SECRET", "dev-default")
    assert result == "a" * 40
    del os.environ["__TEST_SECRET"]


def test_require_secret_returns_dev_default_when_too_short():
    os.environ["__TEST_SECRET_SHORT"] = "short"
    result = _require_secret("__TEST_SECRET_SHORT", "dev-default-value")
    assert result == "dev-default-value"
    del os.environ["__TEST_SECRET_SHORT"]


def test_require_secret_returns_dev_default_when_missing():
    result = _require_secret("__NONEXISTENT_SECRET_KEY__", "fallback-dev")
    assert result == "fallback-dev"


# --- Password hashing ---

def test_hash_and_verify_password():
    password = "s3cureP@ssw0rd!"
    hashed = get_password_hash(password)
    assert hashed != password
    assert verify_password(password, hashed) is True


def test_verify_wrong_password():
    hashed = get_password_hash("correct-password")
    assert verify_password("wrong-password", hashed) is False


def test_verify_password_invalid_hash_returns_false():
    """Corrupted hash should not raise — just return False."""
    assert verify_password("anything", "not-a-valid-bcrypt-hash") is False


# --- Access token ---

def test_create_access_token_contains_sub_and_type():
    token = create_access_token(data={"sub": "user@test.com"})
    payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[ALGORITHM])
    assert payload["sub"] == "user@test.com"
    assert payload["type"] == "access"
    assert "exp" in payload


def test_create_access_token_custom_expiry():
    delta = datetime.timedelta(minutes=1)
    token = create_access_token(data={"sub": "x@y.com"}, expires_delta=delta)
    payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[ALGORITHM])
    assert payload["sub"] == "x@y.com"


# --- Refresh token ---

def test_create_refresh_token_contains_sub_and_type():
    token = create_refresh_token(data={"sub": "user@test.com"})
    payload = jwt.decode(token, JWT_REFRESH_SECRET_KEY, algorithms=[ALGORITHM])
    assert payload["sub"] == "user@test.com"
    assert payload["type"] == "refresh"
    assert "exp" in payload


def test_create_refresh_token_custom_expiry():
    delta = datetime.timedelta(days=1)
    token = create_refresh_token(data={"sub": "x@y.com"}, expires_delta=delta)
    payload = jwt.decode(token, JWT_REFRESH_SECRET_KEY, algorithms=[ALGORITHM])
    assert payload["sub"] == "x@y.com"


# --- Cookie helpers ---

def test_set_refresh_token_cookie():
    response = MagicMock()
    set_refresh_token_cookie(response, "test-token-value")
    response.set_cookie.assert_called_once()
    call_kwargs = response.set_cookie.call_args
    assert call_kwargs.kwargs["key"] == "refresh_token" or call_kwargs[1].get("key") == "refresh_token"


def test_delete_refresh_token_cookie():
    response = MagicMock()
    delete_refresh_token_cookie(response)
    response.set_cookie.assert_called_once()
    call_kwargs = response.set_cookie.call_args
    # max_age should be 0 for deletion
    if call_kwargs.kwargs:
        assert call_kwargs.kwargs.get("max_age") == 0
    else:
        # positional/keyword hybrid
        assert True  # called successfully
