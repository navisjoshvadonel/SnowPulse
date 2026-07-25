"""Tests for backend.app.forecasting.predictor — ForecastingPredictor."""

import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "testsecretkeytestsecretkeytestsecretkey")
os.environ.setdefault("JWT_REFRESH_SECRET_KEY", "testrefreshsecretkeytestrefreshsecretkey")
os.environ.setdefault("ENV", "testing")

from unittest.mock import MagicMock, patch

import pytest

from backend.app.forecasting.predictor import ForecastingPredictor


class TestForecastingPredictor:
    def test_predictor_not_loaded_when_model_missing(self):
        """When no model file exists, predictor.loaded should be False."""
        predictor = ForecastingPredictor(dataset_id=99999)
        assert predictor.loaded is False

    def test_predict_raises_when_not_loaded(self):
        predictor = ForecastingPredictor(dataset_id=99999)
        with pytest.raises(RuntimeError, match="not loaded"):
            predictor.predict(steps=10)

    def test_generate_explanation_increasing(self):
        predictor = ForecastingPredictor.__new__(ForecastingPredictor)
        predictor.model_name = "ARIMA"
        predictor.target_col = "Revenue"
        explanation = predictor.generate_explanation([100.0, 110.0, 120.0, 150.0], steps=4)
        assert "increasing" in explanation
        assert "Revenue" in explanation
        assert "ARIMA" in explanation

    def test_generate_explanation_decreasing(self):
        predictor = ForecastingPredictor.__new__(ForecastingPredictor)
        predictor.model_name = "SARIMA"
        predictor.target_col = "Sales"
        explanation = predictor.generate_explanation([200.0, 180.0, 160.0, 140.0], steps=4)
        assert "decreasing" in explanation
        assert "downward pressure" in explanation

    def test_generate_explanation_stable(self):
        predictor = ForecastingPredictor.__new__(ForecastingPredictor)
        predictor.model_name = "ETS"
        predictor.target_col = "Count"
        explanation = predictor.generate_explanation([100.0, 100.5, 100.2, 100.1], steps=4)
        assert "stable" in explanation
        assert "consistent" in explanation

    def test_generate_explanation_empty_forecast(self):
        predictor = ForecastingPredictor.__new__(ForecastingPredictor)
        predictor.model_name = "ARIMA"
        predictor.target_col = "X"
        explanation = predictor.generate_explanation([], steps=0)
        assert explanation == "No forecast generated."
