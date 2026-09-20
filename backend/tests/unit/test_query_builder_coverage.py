import pandas as pd
import polars as pl
import pytest
from app.analytics.code_executor import PolarsCodeExecutionError, PolarsCodeExecutor
from app.analytics.profiler import DatasetProfiler
from app.analytics.query_builder import (
    DashboardAggregatePayload,
    DynamicQueryEngine,
    QueryFilter,
    QueryMetric,
    QueryPayload,
)
from app.analytics.rules_engine import ChartSuggester
from app.analytics.semantic_enricher import SemanticEnricher
from app.analytics.semantic_layer import DimensionDef, MetricDef, SemanticModel, semantic_layer
from app.cache.cache_service import CacheService


def test_semantic_enricher_fallback():
    df = pl.DataFrame({
        "Sales": [100.0, 200.0, 150.0, 300.0, 250.0],
        "Cost": [50.0, 80.0, 60.0, 120.0, 100.0],
        "Category": ["A", "B", "A", "B", "A"],
    })
    profile = DatasetProfiler.profile_full(df)
    suggester = ChartSuggester(df, profile)
    suggestions = suggester.suggest(top_n=3)

    enricher = SemanticEnricher()
    enrichment = enricher.enrich(profile, suggestions, dataset_name="Test Sales")
    assert enrichment.is_fallback is True
    assert "Test Sales" in enrichment.dataset_summary
    assert len(enrichment.enriched_suggestions) > 0


def test_cache_service_fallback_mode():
    cache = CacheService()
    cache.enabled = False
    assert cache.get("test") is None
    assert cache.set("test", "value", 60) is False
    assert cache.invalidate("test") is False
    assert cache.invalidate_pattern("test*") is False


def test_polars_code_executor():
    df = pl.DataFrame({"a": [1, 2, 3], "b": [10, 20, 30]})
    code = "result = ldf.filter(pl.col('a') > 1)"
    final_df, report = PolarsCodeExecutor.execute_cleaning_code(df, code)
    assert final_df.height == 2
    assert report["status"] == "success"

    # Test LazyFrame input directly
    final_df_lazy, _ = PolarsCodeExecutor.execute_cleaning_code(df.lazy(), "result = ldf.filter(pl.col('a') == 3)")
    assert final_df_lazy.height == 1

    # Test DataFrame result
    final_df_df, _ = PolarsCodeExecutor.execute_cleaning_code(df, "result = ldf.collect()")
    assert final_df_df.height == 3

    # Test error handling
    with pytest.raises(PolarsCodeExecutionError):
        PolarsCodeExecutor.execute_cleaning_code(df, "invalid_python_code +++")

    with pytest.raises(PolarsCodeExecutionError):
        PolarsCodeExecutor.execute_cleaning_code("invalid_type", "result = df")

    with pytest.raises(PolarsCodeExecutionError):
        PolarsCodeExecutor.execute_cleaning_code(df, "result = 'not_a_df'")


def test_chart_suggester():
    df = pl.DataFrame({
        "Sales": [100.0, 200.0, 150.0, 300.0, 250.0],
        "Cost": [50.0, 80.0, 60.0, 120.0, 100.0],
        "Category": ["A", "B", "A", "B", "A"],
        "SubCat": ["X", "Y", "X", "Y", "X"],
        "Date": ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05"],
        "ID_col": [1, 2, 3, 4, 5],
        "MissingCol": [1.0, None, None, None, None]
    })
    profile = DatasetProfiler.profile_full(df)
    suggester = ChartSuggester(df, profile)
    suggestions = suggester.suggest(top_n=5)
    assert len(suggestions) > 0


def test_execute_query_filters_aggs_sorting(tmp_path):
    df = pd.DataFrame({
        "Region": ["North", "South", "East", "West", "North", "South"],
        "Category": ["Tech", "Tech", "Office", "Office", "Tech", "Office"],
        "Sales": [100.0, 200.0, 150.0, 300.0, 250.0, 50.0],
        "Units": [10, 20, 15, 30, 25, 5],
        "Date": ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05", "2026-01-06"]
    })
    file_path = str(tmp_path / "sales.csv")
    df.to_csv(file_path, index=False)

    # Test all filter operators and aggregations
    query = QueryPayload(
        dimensions=["Region"],
        metrics=[
            QueryMetric(column="Sales", agg="sum"),
            QueryMetric(column="Sales", agg="avg"),
            QueryMetric(column="Units", agg="count"),
            QueryMetric(column="Units", agg="min"),
            QueryMetric(column="Units", agg="max"),
        ],
        filters=[
            QueryFilter(column="Sales", op="eq", value=100.0),
            QueryFilter(column="Sales", op="gte", value=50.0),
            QueryFilter(column="Sales", op="lte", value=300.0),
            QueryFilter(column="Sales", op=">=", value=50.0),
            QueryFilter(column="Sales", op="<=", value=300.0),
            QueryFilter(column="Sales", op=">", value=10.0),
            QueryFilter(column="Sales", op="<", value=400.0),
            QueryFilter(column="Sales", op="!=", value=999.0),
            QueryFilter(column="Region", op="==", value="North"),
            QueryFilter(column="Category", op="in", value=["Tech", "Office"]),
            QueryFilter(column="Units", op="between", value=[5, 50]),
        ],
        sort_by="Sales_sum",
        sort_desc=True,
        limit=10,
    )

    res = DynamicQueryEngine.execute_query(file_path, query)
    assert res["success"] is True
    assert "data" in res

    # Test 'mean' agg alias separately
    query_mean = QueryPayload(
        metrics=[QueryMetric(column="Sales", agg="mean")]
    )
    res_mean = DynamicQueryEngine.execute_query(file_path, query_mean)
    assert res_mean["success"] is True


def test_execute_query_semantic_model(tmp_path):
    df = pd.DataFrame({
        "region_col": ["North", "South"],
        "revenue_col": [500.0, 1000.0]
    })
    file_path = str(tmp_path / "semantic_test.csv")
    df.to_csv(file_path, index=False)

    sm = SemanticModel(
        name="test_model",
        description="Model for query test",
        dimensions=[DimensionDef(name="region", description="Region dim", column="region_col")],
        metrics=[MetricDef(name="total_revenue", description="Total rev", column="revenue_col", agg="sum")]
    )
    semantic_layer.register_model(sm)

    # Test context for LLM
    ctx = semantic_layer.get_context_for_llm("test_model")
    assert "test_model" in ctx
    assert "No semantic model found." == semantic_layer.get_context_for_llm("invalid")

    query = QueryPayload(
        semantic_model_name="test_model",
        semantic_dimensions=["region", "non_existent_dim"],
        semantic_metrics=["total_revenue", "non_existent_metric"],
    )

    res = DynamicQueryEngine.execute_query(file_path, query)
    assert res["success"] is True
    assert len(res["data"]) > 0


def test_execute_dashboard_aggregation_all_filters(tmp_path):
    df = pd.DataFrame({
        "region": ["North", "South", "East", "West", "North"],
        "category": ["Tech", "Office", "Tech", "Office", "Tech"],
        "sales": [100.0, 200.0, 150.0, 300.0, 250.0],
        "date": ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05"]
    })
    file_path = str(tmp_path / "dash_agg.csv")
    df.to_csv(file_path, index=False)

    payload = DashboardAggregatePayload(
        selectedRegion="North",
        selectedCategory="Tech",
        date_range={"start": "2026-01-01", "end": "2026-01-10"},
        brushedRange=[50.0, 300.0],
        active_category_values={"category": ["Tech"]},
        active_numeric_ranges={"sales": [50.0, 350.0]},
        filters=[
            QueryFilter(column="sales", op=">", value=10.0),
            QueryFilter(column="sales", op="<", value=500.0),
            QueryFilter(column="region", op="!=", value="Other"),
            QueryFilter(column="category", op="in", value=["Tech"]),
            QueryFilter(column="sales", op="between", value=[10.0, 500.0]),
            QueryFilter(column="sales", op="==", value=100.0),
        ]
    )

    res = DynamicQueryEngine.execute_dashboard_aggregation(file_path, payload)
    assert res["success"] is True
    assert "kpis" in res
    assert "numeric_kpis" in res
    assert "categorical_breakdowns" in res
    assert "geoData" in res
    assert "trends" in res


def test_query_engine_error_handling():
    res = DynamicQueryEngine.execute_query("non_existent_file.csv", QueryPayload())
    assert res["success"] is False
    assert "error" in res

    res_dash = DynamicQueryEngine.execute_dashboard_aggregation("non_existent_file.csv", DashboardAggregatePayload())
    assert res_dash["success"] is False
    assert "error" in res_dash
