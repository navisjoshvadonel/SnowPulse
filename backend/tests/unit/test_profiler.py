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
