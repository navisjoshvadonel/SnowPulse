"""
Unit tests for SnowPulse AI Ubuntu Native Suite:
- UniversalDataLoader
- NativeDataAnalyzer
- NativeAutoMLEngine
- NativeDataChatAgent
- HTMLReportGenerator
- Desktop Integration
"""

import os
from pathlib import Path
import polars as pl
import pytest

from app.native.loader import load_dataset
from app.native.analyzer import NativeDataAnalyzer
from app.native.automl import NativeAutoMLEngine
from app.native.chat import NativeDataChatAgent
from app.native.report import generate_html_report
from app.native.desktop import install_desktop_integration, send_desktop_notification


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


def test_cli_chat_single_query(sample_df, tmp_path):
    from unittest.mock import MagicMock
    from app.native.cli import cmd_chat
    csv_file = tmp_path / "data.csv"
    sample_df.write_csv(csv_file)

    args = MagicMock()
    args.dataset = str(csv_file)
    args.query = "average mrr by plan"
    assert cmd_chat(args) == 0


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


def test_desktop_app_api(sample_df, tmp_path):
    from app.native.gui import DesktopAppAPI, build_app_html
    csv_file = tmp_path / "app_data.csv"
    sample_df.write_csv(csv_file)

    api = DesktopAppAPI(str(csv_file))
    res = api.load_dataset(str(csv_file))
    assert res["success"] is True
    assert res["summary"]["rows"] == 30
    assert len(res["preview_rows"]) > 0

    # Test chat query
    chat_res = api.chat_query("show top 5 rows")
    assert chat_res["success"] is True
    assert len(chat_res["rows"]) == 5

    # Test AutoML
    automl_res = api.run_automl("plan")
    assert automl_res["success"] is True

    # Test HTML construction
    html = build_app_html()
    assert "SnowPulse AI" in html
    assert "Conversational AI" in html


def test_preprocessor_audit_and_cleaning():
    from app.native.cleaner import NativeDataPreprocessor
    # Create dirty DataFrame with duplicates, nulls, and an outlier
    dirty_df = pl.DataFrame({
        "customer_id": ["C1", "C2", "C3", "C4", "C5", "C5"], # duplicate row C5
        "tier": ["Pro", "Free", None, "Pro", "Enterprise", "Enterprise"], # missing cell
        "revenue": [100.0, 50.0, 80.0, 95.0, 10000.0, 10000.0], # extreme outlier
        "created_at": ["2023-01-01", "2023-01-02", "2023-01-03", "2023-01-04", "2023-01-05", "2023-01-05"],
    })

    audit = NativeDataPreprocessor.audit(dirty_df)
    assert audit["total_rows"] == 6
    assert audit["total_missing"] == 1
    assert audit["duplicate_rows"] == 1
    assert audit["needs_cleaning"] is True

    clean_df, report = NativeDataPreprocessor.clean(dirty_df, config={
        "deduplicate": True,
        "missing_numeric_strategy": "median",
        "missing_categorical_strategy": "mode",
        "outlier_strategy": "clip",
    })

    assert clean_df.height == 5 # 1 duplicate dropped
    assert clean_df["tier"].null_count() == 0 # imputed
    assert report["final_health_score"] > report["initial_health_score"]
    assert report["duplicates_removed"] == 1
    assert report["missing_resolved"] == 1


def test_smart_chart_candidates_avoids_identifiers():
    df = pl.DataFrame({
        "customer_id": [f"ID-{i}" for i in range(50)], # 100% unique ID
        "region": ["NA", "EU", "APAC"] * 16 + ["NA", "EU"], # 3 distinct categories
        "arr": [1000.0 + i * 50 for i in range(50)],
    })

    analyzer = NativeDataAnalyzer(df, name="IDTest")
    candidates = analyzer.get_smart_chart_candidates()

    assert candidates["primary_dimension"] == "region" # NOT customer_id!
    assert candidates["primary_dimension"] != "customer_id"
    assert candidates["primary_metric"] == "arr"


def test_desktop_app_preprocessing_and_reactive_filters(tmp_path):
    import json
    from app.native.gui import DesktopAppAPI
    csv_file = tmp_path / "multi_stage.csv"
    df = pl.DataFrame({
        "account_id": [f"ACC-{i}" for i in range(20)],
        "segment": ["SMB", "Enterprise"] * 10,
        "spend": [100.0 + i * 10 for i in range(20)],
    })
    df.write_csv(csv_file)

    api = DesktopAppAPI()
    load_res = api.load_dataset(str(csv_file))
    assert load_res["success"] is True
    assert load_res["rows"] == 20

    # Stage 2 -> 3 Preprocessing
    clean_res = api.run_preprocessing(json.dumps({"deduplicate": True}))
    assert clean_res["success"] is True
    assert "dashboard_data" in clean_res
    assert clean_res["dashboard_data"]["summary"]["rows"] == 20
    assert clean_res["dashboard_data"]["chart_category"]["title"] == "segment"

    # Stage 4 Reactive Slicer Filter
    filter_res = api.apply_dashboard_filters(json.dumps({"segment": "SMB"}))
    assert filter_res["success"] is True
    assert filter_res["dashboard_data"]["summary"]["rows"] == 10 # Filtered from 20 down to 10!


def test_cli_clean_subcommand(tmp_path):
    from unittest.mock import MagicMock
    from app.native.cli import cmd_clean
    csv_in = tmp_path / "dirty.csv"
    csv_out = tmp_path / "cleaned.csv"
    df = pl.DataFrame({
        "id": ["A", "B", "B"],
        "metric": [10.0, None, 20.0],
    })
    df.write_csv(csv_in)

    args = MagicMock()
    args.dataset = str(csv_in)
    args.output = str(csv_out)
    args.impute = "mean"
    args.keep_duplicates = False
    args.winsorize = False
    args.no_normalize_text = False
    args.report = False

    exit_code = cmd_clean(args)
    assert exit_code == 0
    assert csv_out.exists()

