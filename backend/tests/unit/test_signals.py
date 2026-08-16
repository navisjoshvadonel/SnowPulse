import polars as pl

from backend.app.analytics.profiler import DatasetProfiler
from backend.app.analytics.signals import SignalDetector


def test_signal_detector_outliers_and_imbalance():
    # Synthetic dataframe with outliers in col_a and imbalance in col_b
    df = pl.DataFrame({
        "col_a": [10.0, 12.0, 11.0, 10.5, 11.2, 10.8, 11.1, 10.9, 12.1, 100.0, 105.0] * 5,
        "col_b": ["electronics"] * 50 + ["fashion"] * 5,
        "col_c": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] * 5
    })

    profile = DatasetProfiler.profile_full(df)
    signals = SignalDetector.detect_signals(df, profile)

    assert len(signals) > 0
    signal_types = [s.signal_type for s in signals]
    assert "outlier" in signal_types or "category_imbalance" in signal_types

    for s in signals:
        assert 0.0 <= s.severity_score <= 1.0
        assert len(s.columns) > 0


def test_signal_detector_missingness_cluster():
    # Synthetic dataframe with correlated missingness
    val_a = [None if i % 4 == 0 else float(i) for i in range(100)]
    val_b = [None if i % 4 == 0 or i % 8 == 0 else float(i) for i in range(100)]
    val_c = [float(i) for i in range(100)]

    df = pl.DataFrame({"a": val_a, "b": val_b, "c": val_c})
    profile = DatasetProfiler.profile_full(df)
    signals = SignalDetector.detect_signals(df, profile)

    missing_signals = [s for s in signals if s.signal_type == "missingness_cluster"]
    assert len(missing_signals) > 0
    assert "a" in missing_signals[0].columns or "b" in missing_signals[0].columns
