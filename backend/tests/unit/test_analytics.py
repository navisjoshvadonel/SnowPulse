
import pytest

from backend.app.analytics.engine import AnalyticsEngine


@pytest.fixture
def sample_csv(tmp_path):
    csv_file = tmp_path / "test_data.csv"
    content = (
        "Date,Revenue,Category,Region,Outliers\n"
        "2024-01-01,100,Electronics,North,10\n"
        "2024-02-01,150,Electronics,North,15\n"
        "2024-03-01,200,Apparel,South,20\n"
        "2024-04-01,250,Apparel,South,25\n"
        "2024-05-01,1000,Electronics,East,100\n"  # Anomaly
        "2024-06-01,300,Home,West,30\n"
        "2024-07-01,105,Electronics,North,11\n"
        "2024-08-01,145,Electronics,North,14\n"
        "2024-09-01,210,Apparel,South,21\n"
        "2024-10-01,240,Apparel,South,24\n"
        "2024-11-01,290,Home,West,29\n"
    )
    csv_file.write_text(content)
    return str(csv_file)

def test_engine_init(sample_csv):
    engine = AnalyticsEngine(sample_csv)
    assert engine.num_rows == 11
    assert "Revenue" in engine.numeric_cols
    assert "Date" in engine.date_cols
    assert "Category" in engine.categorical_cols
    assert "Region" in engine.geo_cols
    assert "Electronics" in engine.categorical_unique_values["Category"]
    assert "North" in engine.categorical_unique_values["Region"]

def test_engine_kpis(sample_csv):
    engine = AnalyticsEngine(sample_csv)
    kpis = engine.get_kpis()
    assert kpis["total_value"] == 2990
    assert kpis["mean_value"] == pytest.approx(271.81, 0.01)
    assert kpis["total_records"] == 11
    assert kpis["unique_categories"] == 3
    assert kpis["unique_regions"] == 4
    assert kpis["quality_score"] == 100

def test_engine_trends(sample_csv):
    engine = AnalyticsEngine(sample_csv)
    trends = engine.get_trends()
    assert trends["metric"] == "Revenue"
    assert len(trends["dates"]) == 11
    assert len(trends["values"]) == 11
    assert len(trends["moving_average"]) == 11

def test_engine_geo_metrics(sample_csv):
    engine = AnalyticsEngine(sample_csv)
    geo = engine.get_geo_metrics()
    assert len(geo) == 4
    # Check sorting by value descending
    assert geo[0]["region"] == "East"
    assert geo[0]["value"] == 1000

def test_engine_anomalies(sample_csv):
    engine = AnalyticsEngine(sample_csv)
    anoms = engine.get_anomalies()
    # There should be at least one high severity outlier (1000)
    assert len(anoms) > 0
    assert any(a["value"] == 1000 for a in anoms)
    assert any(a["severity"] in ["Critical", "High", "Medium"] for a in anoms)
    # The root cause analysis should trace it to Outliers
    assert "root_cause" in anoms[0]

def test_engine_correlations(sample_csv):
    engine = AnalyticsEngine(sample_csv)
    corr = engine.get_correlations()
    assert "columns" in corr
    assert "matrix" in corr
    # Revenue and Outliers are perfectly correlated (10x)
    revenue_idx = corr["columns"].index("Revenue")
    outliers_idx = corr["columns"].index("Outliers")
    correlation_val = corr["matrix"][revenue_idx][outliers_idx]
    assert correlation_val == pytest.approx(1.0, 0.01)

def test_engine_context_summary(sample_csv):
    engine = AnalyticsEngine(sample_csv)
    summary = engine.generate_statistical_context_summary()
    assert "Primary target metric" in summary
    assert "Total rows: 11" in summary
    assert "Total aggregate value: 2,990.00" in summary
    assert "Electronics" in summary
    assert "North" in summary
import polars as pl
import numpy as np
from unittest.mock import patch
from backend.app.analytics.engine import AnalyticsEngine

@patch("backend.app.analytics.engine._load_df")
def test_engine_correlations_fallback_matrix_empty_numeric(mock_load):
    mock_load.return_value = pl.DataFrame({"a": ["a", "b", "c"]})
    df = pl.DataFrame({"a": ["a", "b", "c"]})
    engine = AnalyticsEngine(file_path="dummy.csv")
    engine.df = df
    engine.numeric_cols = []
    engine.headers = ["a"]
    class DummyProfile:
        correlation_matrix = None
    engine._profile = DummyProfile()

    res = engine.get_correlations()
    assert res["columns"] == []
    assert res["matrix"] == [[1.0]]

@patch("backend.app.analytics.engine._load_df")
def test_engine_correlations_fallback_matrix_short_df(mock_load):
    mock_load.return_value = pl.DataFrame({"a": [1, 2], "b": [2, 3]})
    df = pl.DataFrame({"a": [1, 2], "b": [2, 3]})
    engine = AnalyticsEngine(file_path="dummy.csv")
    engine.df = df
    engine.numeric_cols = ["a", "b"]
    engine.headers = ["a", "b"]
    class DummyProfile:
        correlation_matrix = None
    engine._profile = DummyProfile()

    res = engine.get_correlations()
    assert res["columns"] == ["a", "b"]
    assert res["matrix"] == [[1.0, 1.0], [1.0, 1.0]]

@patch("backend.app.analytics.engine._load_df")
def test_engine_correlations_fallback_matrix_from_profile(mock_load):
    mock_load.return_value = pl.DataFrame({"a": [1, 2, 3], "b": [4, 5, 6]})
    df = pl.DataFrame({"a": [1, 2, 3], "b": [4, 5, 6]})
    engine = AnalyticsEngine(file_path="dummy.csv")
    engine.df = df
    engine.numeric_cols = ["a", "b"]
    engine.headers = ["a", "b"]
    class DummyCM:
        columns = ["a", "b"]
        matrix = [[1.0, 0.5], [0.5, 1.0]]
    class DummyProfile:
        correlation_matrix = DummyCM()
    engine._profile = DummyProfile()

    res = engine.get_correlations()
    assert res["columns"] == ["a", "b"]
    assert res["matrix"] == [[1.0, 0.5], [0.5, 1.0]]

@patch("backend.app.analytics.engine._load_df")
def test_engine_correlations_single_col(mock_load):
    mock_load.return_value = pl.DataFrame({"a": [1, 2, 3]})
    df = pl.DataFrame({"a": [1, 2, 3]})
    engine = AnalyticsEngine(file_path="dummy.csv")
    engine.df = df
    engine.numeric_cols = ["a"]
    engine.headers = ["a"]
    class DummyProfile:
        correlation_matrix = None
    engine._profile = DummyProfile()

    res = engine.get_correlations()
    assert res["columns"] == ["a"]
    assert res["matrix"] == [[1.0]]

@patch("backend.app.analytics.engine._load_df")
def test_engine_correlations_empty(mock_load):
    mock_load.return_value = pl.DataFrame({"a": []}, schema={"a": pl.Int64})
    df = pl.DataFrame({"a": []}, schema={"a": pl.Int64})
    engine = AnalyticsEngine(file_path="dummy.csv")
    engine.df = df
    engine.numeric_cols = ["a"]
    engine.headers = ["a"]
    class DummyProfile:
        correlation_matrix = None
    engine._profile = DummyProfile()

    res = engine.get_correlations()
    assert res["columns"] == ["a"]
    assert res["matrix"] == [[1.0]]

@patch("backend.app.analytics.engine._load_df")
def test_engine_correlations_nan(mock_load):
    mock_load.return_value = pl.DataFrame({"a": [1.0, 2.0, np.nan], "b": [1.0, np.nan, 3.0]})
    df = pl.DataFrame({"a": [1.0, 2.0, np.nan], "b": [1.0, np.nan, 3.0]})
    engine = AnalyticsEngine(file_path="dummy.csv")
    engine.df = df
    engine.numeric_cols = ["a", "b"]
    engine.headers = ["a", "b"]
    class DummyProfile:
        correlation_matrix = None
    engine._profile = DummyProfile()

    res = engine.get_correlations()
    assert res["columns"] == ["a", "b"]
    assert np.isnan(res["matrix"][0][1]) or res["matrix"][0][1] == 0.0
