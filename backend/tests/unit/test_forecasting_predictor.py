import io
from unittest.mock import patch

import joblib
import numpy as np
import pytest

from app.forecasting.predictor import ForecastingPredictor


def test_forecasting_predictor_not_loaded():
    with patch("app.forecasting.predictor.storage_service.get_file", side_effect=Exception("Not found")):
        predictor = ForecastingPredictor(dataset_id=999)
        assert predictor.loaded is False
        with pytest.raises(RuntimeError, match="not loaded or not found"):
            predictor.predict()


class DummyModel:
    def forecast(self, steps=3):
        return np.array([10.0, 11.0, 12.0])
    @property
    def resid(self):
        return np.array([0.1, -0.1, 0.05])

def test_forecasting_predictor_success():
    payload = {
        "fitted_model": DummyModel(),
        "model_name": "Exponential Smoothing",
        "target_col": "revenue",
        "last_date": "2026-01-01",
        "series_values": [5.0, 6.0, 7.0, 8.0, 9.0],
        "series_dates": ["2025-12-28", "2025-12-29", "2025-12-30", "2025-12-31", "2026-01-01"]
    }
    buf = io.BytesIO()
    joblib.dump(payload, buf)
    payload_bytes = buf.getvalue()

    with patch("app.forecasting.predictor.storage_service.get_file", return_value=payload_bytes):
        predictor = ForecastingPredictor(dataset_id=1)
        assert predictor.loaded is True
        res = predictor.predict(steps=3)

        assert res["target_column"] == "revenue"
        assert res["model_type"] == "Exponential Smoothing"
        assert len(res["forecast_values"]) == 3
        assert "revenue" in res["explanation"]
