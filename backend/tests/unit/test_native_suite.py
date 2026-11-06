"""
Unit tests for SnowPulse AI Ubuntu Native Suite:
- UniversalDataLoader
- NativeDataAnalyzer
- NativeAutoMLEngine
- NativeDataChatAgent
- HTMLReportGenerator
- Desktop Integration
"""

from pathlib import Path

import polars as pl
import pytest
from app.native.analyzer import NativeDataAnalyzer
from app.native.automl import NativeAutoMLEngine
from app.native.chat import NativeDataChatAgent
from app.native.desktop import install_desktop_integration, send_desktop_notification
from app.native.loader import load_dataset
from app.native.report import generate_html_report


@pytest.fixture
def sample_df():
    return pl.DataFrame({
        "customer_id": [f"CUST-{i}" for i in range(1, 31)],
        "plan": ["Starter"] * 10 + ["Pro"] * 10 + ["Enterprise"] * 10,
        "mrr": [50.0 + i * 2.0 for i in range(10)] + [500.0 + i * 5.0 for i in range(10)] + [2000.0 + i * 20.0 for i in range(10)],
        "support_tickets": [i % 5 for i in range(30)],
        "active_users": [10 + i * 3 for i in range(30)],
        "churn": [0] * 12 + [1] * 8 + [0] * 10,
    })


def test_loader_from_csv(tmp_path, sample_df):
    csv_file = tmp_path / "test_data.csv"
    sample_df.write_csv(csv_file)

    loaded = load_dataset(csv_file)
    assert isinstance(loaded, pl.DataFrame)
    assert loaded.height == 30
    assert loaded.width == 6


def test_loader_from_sqlite_security(tmp_path):
    import sqlite3
    db_file = tmp_path / "test_db.sqlite"
    conn = sqlite3.connect(db_file)
    conn.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);")
    conn.execute("INSERT INTO users (name) VALUES ('Alice'), ('Bob');")
    conn.commit()
    conn.close()

    # Valid load without explicit table parameter
    df1 = load_dataset(db_file)
    assert df1.height == 2
    assert "name" in df1.columns

    # Valid load with explicit table parameter
    df2 = load_dataset(db_file, table="users")
    assert df2.height == 2

    # Malicious SQL injection attempt or non-existent table must raise ValueError
    with pytest.raises(ValueError, match="not found in SQLite database"):
        load_dataset(db_file, table="users; DROP TABLE users;--")

    with pytest.raises(ValueError, match="not found in SQLite database"):
        load_dataset(db_file, table="non_existent_table")


def test_analyzer_summary_and_correlations(sample_df):
    analyzer = NativeDataAnalyzer(sample_df, name="TestCustomerData")
    summary = analyzer.get_summary()

    assert summary["name"] == "TestCustomerData"
    assert summary["rows"] == 30
    assert summary["columns"] == 6
    assert summary["quality_score"] > 80.0

    col_stats = analyzer.get_column_stats()
    assert len(col_stats) == 6

    corrs = analyzer.get_top_correlations(min_corr=0.3)
    assert isinstance(corrs, list)
    assert any("mrr" in (c["col_a"], c["col_b"]) for c in corrs)

    narratives = analyzer.generate_narrative()
    assert len(narratives) >= 2


def test_automl_classification(sample_df):
    engine = NativeAutoMLEngine(sample_df, target_col="plan")
    assert engine.task_type == "classification"

    results = engine.run_training()
    assert results["task_type"] == "classification"
    assert "best_model" in results
    assert "metrics" in results
    assert "accuracy" in results["metrics"]
    assert len(results["top_features"]) > 0


def test_automl_regression(sample_df):
    engine = NativeAutoMLEngine(sample_df, target_col="mrr")
    assert engine.task_type == "regression"

    results = engine.run_training()
    assert results["task_type"] == "regression"
    assert "r2_score" in results["metrics"]
    assert "rmse" in results["metrics"]
    assert len(results["top_features"]) > 0


def test_chat_agent_offline_queries(sample_df):
    agent = NativeDataChatAgent(sample_df)

    # 1. Preview
    res1 = agent.query("show top 5 rows")
    assert res1["success"] is True
    assert res1["row_count"] == 5

    # 2. Aggregation
    res2 = agent.query("average mrr by plan")
    assert res2["success"] is True
    assert res2["row_count"] == 3

    # 3. Shape
    res3 = agent.query("how many rows")
    assert res3["success"] is True


def test_html_report_generation(tmp_path, sample_df):
    out_file = tmp_path / "test_report.html"
    html_content = generate_html_report(sample_df, dataset_name="SampleTest", output_path=out_file)

    assert out_file.exists()
    assert "SnowPulse AI" in html_content
    assert "SampleTest" in html_content
    assert "echarts" in html_content


def test_desktop_integration_execution():
    results = install_desktop_integration()
    assert "launcher" in results
    assert "desktop_entry" in results
    assert Path(results["launcher"]).exists()
    assert Path(results["desktop_entry"]).exists()

    notif_ok = send_desktop_notification("Test", "SnowPulse test notification")
    assert isinstance(notif_ok, bool)


def test_cli_doctor_and_install():
    from app.native.cli import cmd_doctor, cmd_install_desktop

    class DummyArgs:
        pass

    args = DummyArgs()
    assert cmd_doctor(args) == 0
    assert cmd_install_desktop(args) == 0
