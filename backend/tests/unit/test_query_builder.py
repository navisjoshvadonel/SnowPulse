from unittest.mock import patch

import polars as pl

from backend.app.analytics.query_builder import (
    DashboardAggregatePayload,
    DynamicQueryEngine,
    QueryFilter,
    QueryMetric,
    QueryPayload,
)


@patch("backend.app.analytics.query_builder._load_df")
def test_dynamic_query_engine_basic(mock_load_df):
    # Mock data
    mock_df = pl.DataFrame({
        "category": ["A", "B", "A", "C"],
        "value": [10, 20, 15, 5],
        "growth": [1, 2, 1, 3]
    })
    mock_load_df.return_value = mock_df

    payload = QueryPayload(
        dimensions=["category"],
        metrics=[QueryMetric(column="value", agg="sum")],
        filters=[],
        sort_by="value_sum",
        sort_desc=True,
        limit=10
    )

    result = DynamicQueryEngine.execute_query("dummy_path", payload)

    assert result["success"] is True
    assert result["total_rows"] == 3
    assert "category" in result["columns"]
    assert "value_sum" in result["columns"]

    # Check data sorted correctly
    data = result["data"]
    assert data[0]["category"] == "A"
    assert data[0]["value_sum"] == 25
    assert data[1]["category"] == "B"
    assert data[1]["value_sum"] == 20


@patch("backend.app.analytics.query_builder._load_df")
def test_dynamic_query_engine_filters(mock_load_df):
    mock_df = pl.DataFrame({
        "category": ["A", "B", "A", "C"],
        "value": [10, 20, 15, 5]
    })
    mock_load_df.return_value = mock_df

    payload = QueryPayload(
        filters=[
            QueryFilter(column="category", op="==", value="A"),
            QueryFilter(column="value", op=">=", value=15)
        ]
    )

    result = DynamicQueryEngine.execute_query("dummy_path", payload)
    assert result["success"] is True
    assert result["total_rows"] == 1
    assert result["data"][0]["value"] == 15


@patch("backend.app.analytics.query_builder._load_df")
def test_dynamic_query_engine_error(mock_load_df):
    mock_load_df.side_effect = Exception("File read error")

    payload = QueryPayload()
    result = DynamicQueryEngine.execute_query("dummy_path", payload)

    assert result["success"] is False
    assert result["error"] == "File read error"


@patch("backend.app.analytics.query_builder._load_df")
def test_dashboard_aggregation_full_lifecycle(mock_load_df):
    mock_df = pl.DataFrame({
        "order_date": ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05", "2026-01-06"],
        "region": ["North", "South", "North", "South", "East", "West"],
        "segment": ["Retail", "Retail", "Enterprise", "Enterprise", "Retail", "Enterprise"],
        "sales": [100.0, 200.0, 150.0, 300.0, 250.0, 400.0],
        "profit": [20.0, 40.0, 30.0, 75.0, 50.0, 100.0],
    })
    mock_load_df.return_value = mock_df

    payload = DashboardAggregatePayload(
        selectedRegion="North",
        selectedCategory="Retail",
        filters=[QueryFilter(column="sales", op=">=", value=100.0)],
        active_category_values={"segment": ["Retail"]},
        active_numeric_ranges={"profit": [10.0, 100.0]},
        date_range={"start": "2026-01-01", "end": "2026-01-05"},
        brushedRange=[50.0, 500.0],
    )

    result = DynamicQueryEngine.execute_dashboard_aggregation("dummy_path.parquet", payload)
    assert result["success"] is True
    assert result["total_records"] >= 1
    assert "kpis" in result
    assert "numeric_kpis" in result
    assert "categorical_breakdowns" in result
    assert "geoData" in result
    assert "trends" in result


@patch("backend.app.analytics.query_builder._load_df")
def test_dashboard_aggregation_error(mock_load_df):
    mock_load_df.side_effect = RuntimeError("Failed to load dataset")
    payload = DashboardAggregatePayload()
    result = DynamicQueryEngine.execute_dashboard_aggregation("bad_path.csv", payload)
    assert result["success"] is False
    assert "Failed to load dataset" in result["error"]

