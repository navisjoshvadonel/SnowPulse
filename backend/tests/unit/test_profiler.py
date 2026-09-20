import warnings

import polars as pl
from app.analytics.profiler import DatasetProfiler


def test_profiler_sales_dataset():
    df = pl.DataFrame({
        "transaction_id": [f"TX-{i}" for i in range(10)],
        "date": ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09", "2026-01-10"],
        "revenue": [100.0, 150.0, 200.0, 120.0, 300.0, 250.0, 180.0, 220.0, 190.0, 1000.0], # 1000 is outlier
        "region": ["APAC", "EMEA", "APAC", "LATAM", "EMEA", "APAC", "LATAM", "EMEA", "APAC", "LATAM"],
        "customer_segment": ["Enterprise", "SMB", "SMB", "Enterprise", "SMB", "Enterprise", "SMB", "Enterprise", "SMB", "Enterprise"]
    })

    schema = DatasetProfiler.profile(df)
    assert schema.total_rows == 10
    assert schema.total_columns == 5

    col_map = {c.name: c for c in schema.columns}
    assert col_map["transaction_id"].inferred_role == "identifier"
    assert col_map["date"].inferred_role == "temporal"
    assert col_map["revenue"].inferred_role == "metric"
    assert col_map["region"].inferred_role == "geo"
    assert col_map["customer_segment"].inferred_role == "dimension"

    # Check numeric stats
    rev_stats = col_map["revenue"].numeric_stats
    assert rev_stats is not None
    assert rev_stats["min"] == 100.0
    assert rev_stats["max"] == 1000.0
    assert rev_stats["outlier_count"] >= 1.0

def test_profiler_iris_dataset():
    df = pl.DataFrame({
        "sepal_length": [5.1, 4.9, 4.7, 4.6, 5.0],
        "sepal_width": [3.5, 3.0, 3.2, 3.1, 3.6],
        "petal_length": [1.4, 1.4, 1.3, 1.5, 1.4],
        "petal_width": [0.2, 0.2, 0.2, 0.2, 0.2],
        "species": ["setosa", "setosa", "setosa", "setosa", "setosa"]
    })

    schema = DatasetProfiler.profile(df)
    col_map = {c.name: c for c in schema.columns}

    assert col_map["sepal_length"].inferred_role == "metric"
    assert col_map["sepal_width"].inferred_role == "metric"
    assert col_map["petal_length"].inferred_role == "metric"
    assert col_map["petal_width"].inferred_role == "metric"
    assert col_map["species"].inferred_role == "target"


def test_profiler_zero_variance_correlation():
    df = pl.DataFrame({
        "constant_col": [5.0, 5.0, 5.0, 5.0, 5.0],
        "normal_col": [1.0, 2.0, 3.0, 4.0, 5.0],
    })

    with warnings.catch_warnings(record=True) as w_list:
        warnings.simplefilter("always")
        profile = DatasetProfiler.profile_full(df)
        runtime_warnings = [w for w in w_list if issubclass(w.category, RuntimeWarning)]
        assert len(runtime_warnings) == 0

    assert profile.correlation_matrix is not None
    assert profile.correlation_matrix.columns == ["constant_col", "normal_col"]
    assert profile.correlation_matrix.matrix[0][0] is None
    assert profile.correlation_matrix.matrix[0][1] is None
    assert profile.correlation_matrix.matrix[1][0] is None
    assert profile.correlation_matrix.matrix[1][1] == 1.0


def test_profiler_zero_numeric_metrics_fallback():
    # Survey dataset with zero continuous numeric metrics
    df = pl.DataFrame({
        "feedback_id": [f"FB-{i}" for i in range(10)],
        "sentiment": ["Positive", "Negative", "Neutral", "Positive", "Positive", "Negative", "Neutral", "Positive", "Negative", "Neutral"],
        "comments": ["Great service", "Too slow", "Average", "Loved it", "Will return", "Bad support", "Okay", "Superb", "Horrible", "Fine"],
    })

    profile = DatasetProfiler.profile_full(df)
    primary_metric = next((c for c in profile.columns if c.is_primary_metric), None)
    assert primary_metric is not None
    assert primary_metric.name != "feedback_id"
    assert primary_metric.numeric_stats is not None


def test_profiler_multi_metric_cv_selection():
    # Dataset with large-scale ID numbers vs high-CV revenue metric
    df = pl.DataFrame({
        "account_id": [1_000_000 + i for i in range(10)],  # std=3.0, mean=1000004.5, CV near 0
        "revenue": [10.0, 500.0, 20.0, 1000.0, 50.0, 2500.0, 30.0, 800.0, 10.0, 1200.0],  # std high, mean~690, CV ~ 1.2
    })

    profile = DatasetProfiler.profile_full(df)
    primary_metric = next((c for c in profile.columns if c.is_primary_metric), None)
    assert primary_metric is not None
    assert primary_metric.name == "revenue"


def test_profiler_non_standard_timestamps():
    df = pl.DataFrame({
        "quarter": ["Q1 2025", "Q2 2025", "Q3 2025", "Q4 2025", "Q1 2026", "Q2 2026", "Q3 2026", "Q4 2026", "Q1 2027", "Q2 2027"],
        "custom_date": ["15/01/2026", "16/01/2026", "17/01/2026", "18/01/2026", "19/01/2026", "20/01/2026", "21/01/2026", "22/01/2026", "23/01/2026", "24/01/2026"],
        "epoch_sec": [1767225600 + i * 86400 for i in range(10)],
    })

    schema = DatasetProfiler.profile(df)
    col_map = {c.name: c for c in schema.columns}
    assert col_map["quarter"].inferred_role == "temporal"
    assert col_map["custom_date"].inferred_role == "temporal"
    assert col_map["epoch_sec"].inferred_role == "temporal"


def test_profiler_high_cardinality_identifiers():
    df = pl.DataFrame({
        "transaction_uuid": [f"UUID-{i:04d}" for i in range(20)],  # cardinality_ratio = 1.0 > 0.85
        "category": ["A", "B"] * 10,
        "amount": [10.0 * i for i in range(20)],
    })

    profile = DatasetProfiler.profile_full(df)
    col_map = {c.name: c for c in profile.columns}
    assert col_map["transaction_uuid"].inferred_role == "identifier"

    # Ensure identifier is excluded from correlation matrix
    if profile.correlation_matrix:
        assert "transaction_uuid" not in profile.correlation_matrix.columns


