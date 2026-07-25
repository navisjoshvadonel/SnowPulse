"""Tests for backend.app.validation.quality — quality scorer with diverse data."""

import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "testsecretkeytestsecretkeytestsecretkey")
os.environ.setdefault("JWT_REFRESH_SECRET_KEY", "testrefreshsecretkeytestrefreshsecretkey")
os.environ.setdefault("ENV", "testing")

import pytest

from backend.app.validation.quality.quality_scorer import DataQualityScorer


class TestDataQualityScorer:
    def test_valid_csv_with_nulls(self):
        data = (
            "Date,Revenue,Category,Region\n"
            "2026-06-01,100.5,A,North\n"
            "2026-06-02,200.0,B,South\n"
            "2026-06-03,,A,North\n"
            "2026-06-04,150.2,B,East\n"
        ).encode("utf-8")

        is_valid, report = DataQualityScorer.validate_and_score(data, "sales.csv")
        assert is_valid is True
        assert report["quality_score"] > 50
        assert report["total_records"] == 4
        assert report["missing_values_count"] == 1

    def test_empty_csv(self):
        data = b"Date,Revenue,Category\n"
        is_valid, report = DataQualityScorer.validate_and_score(data, "empty.csv")
        assert is_valid is False
        assert report["quality_score"] == 0.0

    def test_csv_with_outliers(self):
        data = (
            "Date,Revenue,Category,Region\n"
            "2026-01-01,100,A,North\n"
            "2026-01-02,105,B,South\n"
            "2026-01-03,110,A,East\n"
            "2026-01-04,115,B,West\n"
            "2026-01-05,120,A,North\n"
            "2026-01-06,10000,B,South\n"  # Outlier
            "2026-01-07,125,A,East\n"
            "2026-01-08,130,B,West\n"
        ).encode("utf-8")

        is_valid, report = DataQualityScorer.validate_and_score(data, "outlier_data.csv")
        assert report["total_records"] == 8
        assert report["quality_score"] > 0

    def test_non_sales_csv_uses_dynamic_schema(self):
        """CSVs without Date/Revenue should use dynamic schema."""
        data = (
            "Name,Score,Grade\n"
            "Alice,95,A\n"
            "Bob,82,B\n"
            "Charlie,76,C\n"
        ).encode("utf-8")

        is_valid, report = DataQualityScorer.validate_and_score(data, "grades.csv")
        assert report["schema_type"] == "dynamic_inferred"
        assert report["total_records"] == 3
        assert report["quality_score"] > 50

    def test_read_file_to_pandas_csv(self):
        data = b"a,b,c\n1,2,3\n4,5,6\n"
        df = DataQualityScorer.read_file_to_pandas(data, "test.csv")
        assert len(df) == 2
        assert list(df.columns) == ["a", "b", "c"]

    def test_read_file_to_pandas_invalid_format(self):
        with pytest.raises(ValueError):
            DataQualityScorer.read_file_to_pandas(b"\x00\x01\x02", "binary.xlsx")

    def test_high_null_ratio_reduces_quality(self):
        """Lots of nulls should reduce quality score."""
        data = (
            "A,B,C,D\n"
            ",,,\n"
            ",,,\n"
            "1,2,3,4\n"
        ).encode("utf-8")

        is_valid, report = DataQualityScorer.validate_and_score(data, "nulls.csv")
        assert report["quality_score"] < 90
        assert report["missing_values_count"] > 0
