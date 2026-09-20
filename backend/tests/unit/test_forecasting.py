"""Tests for backend.app.forecasting.predictor & trainer — ForecastingPredictor & ForecastingTrainer."""

import os
from unittest.mock import patch

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "testsecretkeytestsecretkeytestsecretkey")
os.environ.setdefault("JWT_REFRESH_SECRET_KEY", "testrefreshsecretkeytestrefreshsecretkey")
os.environ.setdefault("ENV", "testing")


import pandas as pd
import pytest

from app.forecasting.predictor import ForecastingPredictor
from app.forecasting.trainer import ForecastingTrainer


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


class TestForecastingTrainer:
    def test_init_raises_without_args(self):
        with pytest.raises(ValueError, match=r"Either db \+ dataset_id, df, or file_path must be provided"):
            ForecastingTrainer()

    def test_prepare_time_series(self):
        df = pd.DataFrame({
            "date": pd.date_range("2024-01-01", periods=10, freq="D"),
            "value": [10, 12, 15, 14, 18, 20, 22, 25, 28, 30]
        })
        trainer = ForecastingTrainer(df=df)
        series = trainer._prepare_time_series("value")
        assert len(series) == 10

    @patch("app.forecasting.trainer.storage_service.upload_file")
    def test_train_and_evaluate(self, mock_upload):
        df = pd.DataFrame({
            "date": pd.date_range("2024-01-01", periods=15, freq="D"),
            "value": [10, 12, 15, 14, 18, 20, 22, 25, 28, 30, 32, 35, 38, 40, 42]
        })
        trainer = ForecastingTrainer(df=df, dataset_id=123)
        res = trainer.train_and_evaluate("value", steps=5)

        assert res["dataset_id"] == 123
        assert "best_model" in res
        assert "best_mape" in res
        assert mock_upload.called
