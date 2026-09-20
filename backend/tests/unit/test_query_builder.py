from unittest.mock import patch

import polars as pl
from app.analytics.query_builder import (
    DashboardAggregatePayload,
    DynamicQueryEngine,
    QueryFilter,
    QueryMetric,
    QueryPayload,
)


@patch("app.analytics.query_builder._load_df")
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
        metrics=[
            QueryMetric(column="value", agg="sum"),
            QueryMetric(column="value", agg="avg"),
            QueryMetric(column="value", agg="count"),
            QueryMetric(column="value", agg="min"),
            QueryMetric(column="value", agg="max"),
        ],
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


@patch("app.analytics.query_builder._load_df")
def test_dynamic_query_engine_filters(mock_load_df):
    mock_df = pl.DataFrame({
        "category": ["A", "B", "A", "C"],
        "value": [10, 20, 15, 5]
    })
    mock_load_df.return_value = mock_df

    payload = QueryPayload(
        filters=[
            QueryFilter(column="category", op="==", value="A"),
            QueryFilter(column="category", op="!=", value="B"),
            QueryFilter(column="value", op=">=", value=10),
            QueryFilter(column="value", op="<=", value=20),
            QueryFilter(column="value", op=">", value=5),
            QueryFilter(column="value", op="<", value=30),
            QueryFilter(column="category", op="in", value=["A", "C"]),
            QueryFilter(column="value", op="between", value=[5, 20]),
        ]
    )

    result = DynamicQueryEngine.execute_query("dummy_path", payload)
    assert result["success"] is True
    assert result["total_rows"] == 2


@patch("app.analytics.query_builder._load_df")
def test_dynamic_query_engine_error(mock_load_df):
    mock_load_df.side_effect = Exception("File read error")

    payload = QueryPayload()
    result = DynamicQueryEngine.execute_query("dummy_path", payload)

    assert result["success"] is False
    assert result["error"] == "File read error"


@patch("app.analytics.query_builder._load_df")
def test_execute_dashboard_aggregation_full(mock_load_df):
    mock_df = pl.DataFrame({
        "region": ["North", "South", "North", "West"],
        "category": ["Tech", "Retail", "Tech", "Services"],
        "value": [100.0, 200.0, 150.0, 50.0],
        "date": ["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04"]
    })
    mock_load_df.return_value = mock_df

    payload = DashboardAggregatePayload(
        selectedRegion="North",
        selectedCategory="Tech",
        date_range={"start": "2024-01-01", "end": "2024-01-03"},
        brushedRange=[50.0, 200.0],
        active_category_values={"category": ["Tech"]},
        active_numeric_ranges={"value": [0.0, 500.0]},
        filters=[QueryFilter(column="value", op=">", value=10.0)]
    )

    result = DynamicQueryEngine.execute_dashboard_aggregation("dummy_path", payload)

    assert result["success"] is True
    assert result["total_records"] > 0
    assert "kpis" in result
    assert "numeric_kpis" in result
    assert "categorical_breakdowns" in result
    assert "geoData" in result
    assert "trends" in result


@patch("app.analytics.query_builder._load_df")
def test_execute_dashboard_aggregation_error(mock_load_df):
    mock_load_df.side_effect = Exception("Dashboard agg error")

    payload = DashboardAggregatePayload()
    result = DynamicQueryEngine.execute_dashboard_aggregation("dummy_path", payload)

    assert result["success"] is False
    assert result["error"] == "Dashboard agg error"
