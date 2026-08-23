import numpy as np
import pandas as pd
import polars as pl
import pytest
from app.analytics.engine import AnalyticsEngine
from app.analytics.profiler import DatasetProfiler
from app.forecasting.generalized_forecaster import GeneralizedForecaster
from app.forecasting.trainer import ForecastingTrainer
from app.ml.trainer import MLTrainer


def test_time_series_resampling_irregular_dates(tmp_path):
    # Dataset with irregular date gaps (weekends skipped, missing random days)
    data = {
        "Date": ["2025-01-01", "2025-01-02", "2025-01-05", "2025-01-06", "2025-01-10"],
        "Sales": [100.0, 120.0, 150.0, 140.0, 200.0]
    }
    csv_file = tmp_path / "irregular_dates.csv"
    pd.DataFrame(data).to_csv(csv_file, index=False)

    trainer = ForecastingTrainer(file_path=str(csv_file))
    series = trainer._prepare_time_series(target_col="Sales", date_col="Date")

    assert not series.empty
    assert series.isnull().sum() == 0  # No NaNs remaining after interpolation/ffill

    # Test GeneralizedForecaster with irregular polars dataframe
    pl_df = pl.DataFrame(data)
    forecaster = GeneralizedForecaster()
    result = forecaster.forecast(df=pl_df, metric_col="Sales", temporal_col="Date", periods=5)
    assert len(result.forecast_points) == 5
    assert result.forecast_points[0].yhat > 0


def test_zero_variance_column_masking():
    # Dataset with constant columns (std == 0)
    df = pd.DataFrame({
        "Revenue": [100.0, 200.0, 150.0, 300.0, 250.0],
        "Cost": [50.0, 80.0, 60.0, 120.0, 100.0],
        "Country": ["USA"] * 5,          # Constant string
        "TaxRate": [0.15] * 5,           # Constant numeric (zero variance)
        "ConstantZeros": [0.0] * 5       # Constant zero
    })
    pl_df = pl.from_pandas(df)
    profile = DatasetProfiler.profile_full(pl_df)

    engine = AnalyticsEngine(pl_df, profile)

    # Correlations should not crash or produce divide-by-zero NaNs
    corr_data = engine.get_correlations()
    assert "TaxRate" not in corr_data["columns"] or corr_data["columns"] == ["Revenue", "Cost"]

    # MLTrainer should filter out constant columns during preprocessing
    ml_trainer = MLTrainer(df, profile)
    ct, feature_cols = ml_trainer._build_preprocessor(target_col="Revenue")
    assert "TaxRate" not in feature_cols
    assert "ConstantZeros" not in feature_cols


def test_robust_anomalies_heavy_tailed_skew():
    # Dataset with extreme outlier (heavy-tailed distribution)
    data = {
        "Date": [f"2025-01-{i:02d}" for i in range(1, 16)],
        "Value": [10.0, 12.0, 11.0, 10.5, 11.2, 9.8, 10.4, 1000.0, 11.0, 10.2, 11.5, 10.8, 11.1, 10.3, 10.9],
        "Category": ["A"] * 15
    }
    pl_df = pl.DataFrame(data)
    profile = DatasetProfiler.profile_full(pl_df)

    engine = AnalyticsEngine(pl_df, profile)
    anomalies = engine.get_anomalies()

    assert len(anomalies) > 0
    # The extreme outlier 1000.0 should be captured with high Z-score
    extreme_anomaly = next((a for a in anomalies if a["value"] == 1000.0), None)
    assert extreme_anomaly is not None
    assert abs(extreme_anomaly["z_score"]) >= 3.0
