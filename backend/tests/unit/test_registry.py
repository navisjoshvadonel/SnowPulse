"""Tests for backend.app.ml.registry — ModelRegistry with mock storage/cache."""

import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "testsecretkeytestsecretkeytestsecretkey")
os.environ.setdefault("JWT_REFRESH_SECRET_KEY", "testrefreshsecretkeytestrefreshsecretkey")
os.environ.setdefault("ENV", "testing")

from unittest.mock import MagicMock, patch

import pytest
from sklearn.linear_model import LinearRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from backend.app.cache.cache_service import cache_service
from backend.app.ml.registry import ModelRegistry


class TestModelRegistryLocal:
    """Test registry with disabled MinIO (local memory fallback)."""

    def test_save_and_load_model_local_cache(self):
        pipeline = Pipeline([("scaler", StandardScaler()), ("model", LinearRegression())])

        # Clear any local cache for this key
        key = "ml_999_classification.joblib"
        ModelRegistry._local_models.pop(key, None)

        # Save model (MinIO will fail, falls back to local)
        uri = ModelRegistry.save_model(
            dataset_id=999,
            task_type="classification",
            pipeline=pipeline,
            metrics={"accuracy": 0.92},
            hyperparams={"C": 1.0},
        )
        assert uri is not None

        # Load from local cache
        loaded = ModelRegistry.load_model(999, "classification")
        assert loaded is not None

    def test_load_nonexistent_model_raises(self):
        # Clear local cache
        ModelRegistry._local_models.pop("ml_888_regression.joblib", None)
        with pytest.raises(RuntimeError, match="not found"):
            ModelRegistry.load_model(888, "regression")

    def test_get_history_key(self):
        key = ModelRegistry._get_history_key(1, "forecast")
        assert "ml_history" in key
        assert "1" in key
        assert "forecast" in key


class TestModelRegistryWithMockCache:
    """Test registry with mocked Redis for history tracking."""

    def test_get_training_history_empty(self):
        original_enabled = cache_service.enabled
        original_client = cache_service.client
        cache_service.enabled = False
        cache_service.client = None
        try:
            history = ModelRegistry.get_training_history(1, "classification")
            assert history == []
        finally:
            cache_service.enabled = original_enabled
            cache_service.client = original_client

    def test_get_training_history_with_data(self):
        mock_client = MagicMock()
        original_enabled = cache_service.enabled
        original_client = cache_service.client
        cache_service.enabled = True
        cache_service.client = mock_client
        mock_client.get.return_value = '[{"version": 1, "metrics": {"accuracy": 0.9}}]'
        try:
            history = ModelRegistry.get_training_history(1, "classification")
            assert len(history) == 1
            assert history[0]["version"] == 1
        finally:
            cache_service.enabled = original_enabled
            cache_service.client = original_client

    def test_save_model_updates_history_in_cache(self):
        mock_client = MagicMock()
        original_enabled = cache_service.enabled
        original_client = cache_service.client
        cache_service.enabled = True
        cache_service.client = mock_client
        mock_client.get.return_value = None  # No existing history
        mock_client.time.return_value = (1234567890, 0)

        pipeline = Pipeline([("model", LinearRegression())])

        try:
            ModelRegistry.save_model(
                dataset_id=777,
                task_type="regression",
                pipeline=pipeline,
                metrics={"r2": 0.85},
                hyperparams={"fit_intercept": True},
            )
            # Should have called set to store history
            mock_client.set.assert_called_once()
        finally:
            cache_service.enabled = original_enabled
            cache_service.client = original_client
