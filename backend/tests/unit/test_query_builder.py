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

    data = result["data"]
    assert data[0]["category"] == "A"
    assert data[0]["value_sum"] == 25


@patch("app.analytics.query_builder._load_df")
def test_dynamic_query_engine_filter_operators_and_aggs(mock_load_df):
    mock_df = pl.DataFrame({
        "category": ["A", "B", "A", "C", "D"],
        "region": ["US", "EU", "US", "EU", "US"],
        "value": [10, 20, 15, 5, 30]
    })
    mock_load_df.return_value = mock_df

    payload = QueryPayload(
        filters=[
            QueryFilter(column="category", op="!=", value="D"),
            QueryFilter(column="value", op=">", value=5),
            QueryFilter(column="value", op="<", value=25),
            QueryFilter(column="value", op="between", value=[10, 20]),
            QueryFilter(column="category", op="in", value=["A", "B"])
        ],
        metrics=[
            QueryMetric(column="value", agg="avg"),
            QueryMetric(column="value", agg="min"),
            QueryMetric(column="value", agg="max"),
            QueryMetric(column="value", agg="count")
        ]
    )

    result = DynamicQueryEngine.execute_query("dummy_path", payload)
    assert result["success"] is True
    data = result["data"]
    assert len(data) == 1
    assert "value_avg" in result["columns"]
    assert "value_min" in result["columns"]
    assert "value_max" in result["columns"]
    assert "value_count" in result["columns"]


@patch("app.analytics.query_builder._load_df")
def test_dynamic_query_engine_error(mock_load_df):
    mock_load_df.side_effect = Exception("File read error")

    payload = QueryPayload()
    result = DynamicQueryEngine.execute_query("dummy_path", payload)

    assert result["success"] is False
    assert result["error"] == "File read error"


@patch("app.analytics.query_builder._load_df")
def test_execute_dashboard_aggregation(mock_load_df):
    mock_df = pl.DataFrame({
        "date": ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04"],
        "region": ["US", "EU", "US", "EU"],
        "category": ["A", "B", "A", "B"],
        "value": [100.0, 200.0, 150.0, 300.0]
    })
    mock_load_df.return_value = mock_df

    payload = DashboardAggregatePayload(
        selectedRegion="US",
        selectedCategory="A",
        date_range={"start": "2026-01-01", "end": "2026-01-04"},
        brushedRange=[50.0, 200.0],
        filters=[QueryFilter(column="value", op=">=", value=100.0)],
        active_category_values={"category": ["A"]},
        active_numeric_ranges={"value": [50.0, 200.0]}
    )

    res = DynamicQueryEngine.execute_dashboard_aggregation("dummy_path", payload)
    assert res["success"] is True
    assert "kpis" in res
    assert "numeric_kpis" in res
    assert "geoData" in res
    assert "trends" in res


@patch("app.analytics.query_builder._load_df")
def test_execute_dashboard_aggregation_error(mock_load_df):
    mock_load_df.side_effect = Exception("Aggregation error")

    payload = DashboardAggregatePayload()
    res = DynamicQueryEngine.execute_dashboard_aggregation("dummy_path", payload)
    assert res["success"] is False
    assert res["error"] == "Aggregation error"
