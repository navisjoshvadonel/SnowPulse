"""Tests for backend.app.logging_config — structured logging configuration."""

import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "testsecretkeytestsecretkeytestsecretkey")
os.environ.setdefault("JWT_REFRESH_SECRET_KEY", "testrefreshsecretkeytestrefreshsecretkey")
os.environ.setdefault("ENV", "testing")

import logging

import structlog

from backend.app.logging_config import configure_logging, logger


def test_configure_logging_runs_without_error():
    """configure_logging() should configure structlog and stdlib logging."""
    configure_logging()  # Should not raise


def test_logger_is_structlog_instance():
    """The module-level logger should be a structlog BoundLogger."""
    assert logger is not None
    # structlog loggers have a .info method
    assert callable(getattr(logger, "info", None))
    assert callable(getattr(logger, "error", None))


def test_configure_logging_sets_info_level():
    configure_logging()
    root = logging.getLogger()
    assert root.level <= logging.INFO
