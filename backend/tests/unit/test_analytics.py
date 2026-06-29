
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
    )
    csv_file.write_text(content)
    return str(csv_file)

def test_engine_init(sample_csv):
    engine = AnalyticsEngine(sample_csv)
    assert engine.num_rows == 6
    assert "Revenue" in engine.numeric_cols
    assert "Date" in engine.date_cols
    assert "Category" in engine.categorical_cols
    assert "Region" in engine.geo_cols

def test_engine_kpis(sample_csv):
    engine = AnalyticsEngine(sample_csv)
    kpis = engine.get_kpis()
    assert kpis["total_value"] == 2000
    assert kpis["mean_value"] == pytest.approx(333.33, 0.01)
    assert kpis["total_records"] == 6
    assert kpis["unique_categories"] == 3
    assert kpis["unique_regions"] == 4
    assert kpis["quality_score"] == 100

def test_engine_trends(sample_csv):
    engine = AnalyticsEngine(sample_csv)
    trends = engine.get_trends()
    assert trends["metric"] == "Revenue"
    assert len(trends["dates"]) == 6
    assert len(trends["values"]) == 6
    assert len(trends["moving_average"]) == 6

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
    assert "Total rows: 6" in summary
    assert "Total aggregate value: 2,000.00" in summary
