import pytest
import polars as pl
from backend.app.analytics.query_builder import QueryPayload, QueryFilter, QueryMetric, DynamicQueryEngine
from unittest.mock import patch

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
