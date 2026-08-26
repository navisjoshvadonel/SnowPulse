
import polars as pl
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


def test_engine_decomposition_tree(sample_csv):
    engine = AnalyticsEngine(sample_csv)
    tree_data = engine.get_decomposition_tree()
    assert "root" in tree_data
    assert tree_data["target_metric"] == "Revenue"
    assert tree_data["total_value"] == 2990
    root = tree_data["root"]
    assert root["node_type"] == "root"
    assert len(root["children"]) > 0
    first_child = root["children"][0]
    assert "impact_pct" in first_child
    assert "delta_value" in first_child
    assert "direction" in first_child
    assert "summary_insight" in tree_data


def test_engine_monte_carlo_simulation(sample_csv):
    engine = AnalyticsEngine(sample_csv)
    sim = engine.get_monte_carlo_simulation(
        target_metric="Revenue",
        steps=12,
        iterations=1000,
        price_delta=0.10,
        cost_delta=0.02,
        churn_delta=0.0,
        volatility=0.15
    )
    assert sim["target_metric"] == "Revenue"
    assert sim["iterations"] == 1000
    assert sim["steps"] == 12
    assert "percentiles" in sim
    assert len(sim["percentiles"]["p10"]) == 13
    assert len(sim["percentiles"]["p50"]) == 13
    assert len(sim["percentiles"]["p90"]) == 13
    assert sim["risk_metrics"]["final_p90"] >= sim["risk_metrics"]["final_p50"]
    assert sim["risk_metrics"]["final_p50"] >= sim["risk_metrics"]["final_p10"]
    assert "distribution_bins" in sim
    assert len(sim["distribution_bins"]) > 0
    assert "ai_risk_narrative" in sim


def test_engine_evaluate_calculated_field():
    dates = [f"2026-01-{i:02d}" for i in range(1, 21)]
    revs = [100.0 + i * 10 for i in range(20)]
    categories = ["North" if i % 2 == 0 else "South" for i in range(20)]
    df = pl.DataFrame({"Date": dates, "Revenue": revs, "Region": categories})

    eng = AnalyticsEngine(df)

    # 1. Rolling average prompt
    res_rolling = eng.evaluate_calculated_field("Calculate 7-day rolling average of revenue")
    assert res_rolling["status"] == "success"
    assert "RollingAvg" in res_rolling["field_name"]
    assert res_rolling["calc_type"] == "rolling_window"
    assert "dax_code" in res_rolling
    assert "lod_code" in res_rolling
    assert res_rolling["field_name"] in eng.df.columns

    # 2. Percentage of total prompt
    res_pct = eng.evaluate_calculated_field("Revenue % of total", field_name="Rev_Pct")
    assert res_pct["status"] == "success"
    assert res_pct["field_name"] == "Rev_Pct"
    assert res_pct["calc_type"] == "percentage_of_total"
    assert res_pct["stats"]["mean"] > 0

    # 3. Z-score prompt
    res_z = eng.evaluate_calculated_field("Z-score of revenue")
    assert res_z["status"] == "success"
    assert res_z["calc_type"] == "z_score"

    # 4. Conditional Tier prompt
    res_tier = eng.evaluate_calculated_field("Performance tier category based on revenue")
    assert res_tier["status"] == "success"
    assert res_tier["inferred_dtype"] == "categorical"
    assert res_tier["field_name"] in eng.df.columns


