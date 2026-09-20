"""
Unit tests for ResilientFileIngestor (Data Ingestion & File Parsing Resilience).
Tests:
1. Character encodings (UTF-8, Latin-1, CP1252, UTF-16)
2. Delimiter autodetect (comma, semicolon, tab, pipe)
3. Header cleanliness & duplicate column handling
4. Clean value formats (currency symbols, percentages, negative parens)
"""

import pandas as pd

from backend.app.validation.resilient_parser import ResilientFileIngestor


class TestResilientFileIngestor:

    def test_encoding_autodetection_latin1(self):
        """Test reading non-UTF8 Latin-1 encoded file with special characters."""
        content = "Date,Category,Revenue (EUR)\n2026-01-01,Café,120.50\n2026-01-02,Naïve,150.00\n".encode("latin-1")
        df = ResilientFileIngestor.read_to_pandas(content, "latin1_test.csv")
        assert len(df) == 2
        assert "revenue_eur" in df.columns or "revenue" in df.columns[2]
        assert df.iloc[0]["category"] == "Café"

    def test_encoding_autodetection_utf16(self):
        """Test reading UTF-16 encoded file."""
        content = "Date\tProduct\tSales\n2026-01-01\tWidget\t500\n".encode("utf-16")
        df = ResilientFileIngestor.read_to_pandas(content, "utf16_test.csv")
        assert len(df) == 1
        assert "sales" in df.columns

    def test_delimiter_autodetect_semicolon(self):
        """Test auto-detecting semicolon separator."""
        content = b"Date;Category;Revenue\n2026-01-01;Electronics;1000\n2026-01-02;Clothing;550\n"
        df = ResilientFileIngestor.read_to_pandas(content, "semicolon.csv")
        assert len(df) == 2
        assert list(df.columns) == ["date", "category", "revenue"]

    def test_delimiter_autodetect_tab(self):
        """Test auto-detecting tab separator."""
        content = b"Date\tRegion\tVolume\n2026-01-01\tNorth\t300\n"
        df = ResilientFileIngestor.read_to_pandas(content, "tab.tsv")
        assert len(df) == 1
        assert "region" in df.columns

    def test_delimiter_autodetect_pipe(self):
        """Test auto-detecting pipe separator."""
        content = b"ID|Name|Score\n101|Alice|98\n102|Bob|85\n"
        df = ResilientFileIngestor.read_to_pandas(content, "pipe.csv")
        assert len(df) == 2
        assert list(df.columns) == ["id", "name", "score"]

    def test_header_cleanliness_special_chars_and_duplicates(self):
        """Test sanitizing column names with special symbols and resolving duplicate names."""
        content = b"Revenue ($),Revenue (%),Category @,Revenue ($)\n100,10,A,100\n200,20,B,200\n"
        df = ResilientFileIngestor.read_to_pandas(content, "headers.csv")
        cols = list(df.columns)
        assert cols[0] == "revenue"
        assert cols[1] == "revenue_1"
        assert cols[2] == "category"
        assert "revenue" in cols[3]

    def test_missing_unnamed_headers(self):
        """Test missing headers or Unnamed columns."""
        content = b",Category,\n100,A,50\n200,B,60\n"
        df = ResilientFileIngestor.read_to_pandas(content, "missing_headers.csv")
        cols = list(df.columns)
        assert cols[0] == "col_1"
        assert cols[1] == "category"
        assert cols[2] == "col_3"

    def test_clean_currency_percentage_values(self):
        """Test stripping currency symbols ($1,250.00, €95.50), percentages (12.5%), and negative parens."""
        content = (
            b'Date,Revenue,Margin,Adjustment\n'
            b'2026-01-01,"$1,250.50",15.5%,$100.00\n'
            b'2026-01-02,"\xc2\xa3950.00",18.0%,(250.00)\n'  # £950.00 in UTF-8 bytes
            b'2026-01-03,"\xe2\x82\xac2,100.00",22.4%,$50.00\n'  # €2,100.00 in UTF-8 bytes
        )
        df = ResilientFileIngestor.read_to_pandas(content, "currencies.csv")
        assert pd.api.types.is_numeric_dtype(df["revenue"])
        assert df["revenue"].iloc[0] == 1250.50
        assert df["revenue"].iloc[1] == 950.00
        assert df["revenue"].iloc[2] == 2100.00
        assert df["margin"].iloc[0] == 15.5
        assert df["adjustment"].iloc[1] == -250.00
