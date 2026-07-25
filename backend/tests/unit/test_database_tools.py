"""Tests for backend.app.ai.tools.database_tools — statistics, quality, forecast, and search tools."""

import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "testsecretkeytestsecretkeytestsecretkey")
os.environ.setdefault("JWT_REFRESH_SECRET_KEY", "testrefreshsecretkeytestrefreshsecretkey")
os.environ.setdefault("ENV", "testing")

import pytest

from backend.app.ai.tools.database_tools import DatabaseTools, SecurityAlertException, sanitize_and_validate_sql


class TestSanitizeSQL:
    def test_safe_select(self):
        result = sanitize_and_validate_sql("SELECT * FROM datasets;")
        assert result == "SELECT * FROM datasets;"

    def test_select_with_comment(self):
        result = sanitize_and_validate_sql("  SELECT count(id) FROM datasets; -- test comment")
        assert result == "SELECT count(id) FROM datasets;"

    def test_block_comment_removal(self):
        result = sanitize_and_validate_sql("SELECT /* this is a comment */ name FROM datasets;")
        assert "/*" not in result

    def test_reject_delete(self):
        with pytest.raises(SecurityAlertException):
            sanitize_and_validate_sql("DELETE FROM datasets;")

    def test_reject_insert(self):
        with pytest.raises(SecurityAlertException):
            sanitize_and_validate_sql("INSERT INTO datasets (name) VALUES ('x');")

    def test_reject_update(self):
        with pytest.raises(SecurityAlertException):
            sanitize_and_validate_sql("UPDATE users SET is_active = 0;")

    def test_reject_drop(self):
        with pytest.raises(SecurityAlertException):
            sanitize_and_validate_sql("SELECT * FROM datasets; DROP TABLE datasets;")

    def test_reject_alter(self):
        with pytest.raises(SecurityAlertException):
            sanitize_and_validate_sql("ALTER TABLE users ADD COLUMN hacked TEXT;")

    def test_reject_truncate(self):
        with pytest.raises(SecurityAlertException):
            sanitize_and_validate_sql("TRUNCATE datasets;")

    def test_reject_sensitive_tables(self):
        with pytest.raises(SecurityAlertException):
            sanitize_and_validate_sql("SELECT * FROM users;")

    def test_reject_refresh_tokens_table(self):
        with pytest.raises(SecurityAlertException):
            sanitize_and_validate_sql("SELECT * FROM refresh_tokens;")

    def test_reject_non_select_start(self):
        with pytest.raises(SecurityAlertException):
            sanitize_and_validate_sql("EXPLAIN SELECT * FROM datasets;")


class TestDatabaseToolsStatistics:
    def test_get_dataset_statistics_with_valid_csv(self, tmp_path):
        csv_file = tmp_path / "test.csv"
        csv_file.write_text(
            "Date,Revenue,Category,Region\n"
            "2024-01-01,100,A,North\n"
            "2024-02-01,200,B,South\n"
            "2024-03-01,300,A,East\n"
        )
        result = DatabaseTools.get_dataset_statistics(str(csv_file))
        assert result["success"] is True
        assert "kpis" in result
        assert "correlations" in result
        assert "summary_context" in result

    def test_get_dataset_statistics_with_invalid_path(self):
        result = DatabaseTools.get_dataset_statistics("/nonexistent/path.csv")
        assert result["success"] is False
        assert "error" in result


class TestDatabaseToolsSearch:
    def test_search_resources_returns_list(self):
        # Search service may be offline; should still return list
        result = DatabaseTools.search_resources("test query")
        assert isinstance(result, list)


class TestDatabaseToolsForecast:
    def test_get_forecast_scenarios_no_model(self):
        result = DatabaseTools.get_forecast_scenarios(dataset_id=99999)
        assert result["success"] is False
        assert "error" in result


class TestDatabaseToolsQuality:
    def test_get_data_quality_report_valid_file(self, tmp_path):
        csv_file = tmp_path / "quality_test.csv"
        csv_file.write_text(
            "Date,Revenue,Category,Region\n"
            "2024-01-01,100,A,North\n"
            "2024-02-01,200,B,South\n"
            "2024-03-01,300,A,East\n"
        )
        result = DatabaseTools.get_data_quality_report(str(csv_file))
        assert result["success"] is True
        assert "quality_score" in result
        assert result["total_records"] == 3

    def test_get_data_quality_report_missing_file(self):
        result = DatabaseTools.get_data_quality_report("/nonexistent/file.csv")
        assert result["success"] is False
        assert "not found" in result["error"].lower()
