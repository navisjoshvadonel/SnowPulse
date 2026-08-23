import csv
import io
import logging
import re
from typing import Any

import pandas as pd
import polars as pl

try:
    import charset_normalizer
except ImportError:
    charset_normalizer = None

logger = logging.getLogger("snowpulse.validation.resilient_parser")


class ResilientFileIngestor:
    """
    Data Ingestion & File Parsing Resilience Layer.

    Sub-Area Upgrades:
    1. Character Encodings: Auto-detection (UTF-8, UTF-8-SIG, ISO-8859-1, Windows-1252, UTF-16)
    2. Delimiter Autodetect: Delimiter sniffing (comma, semicolon, tab, pipe, colon)
    3. Header Cleanliness: Auto-sanitizes special symbols, handles missing headers & duplicate columns
    4. Clean Value Formats: Regex-based data cleaning for currency symbols ($1,250), percentages (12.5%), negative parens (100)
    """

    SUPPORTED_ENCODINGS = [
        "utf-8",
        "utf-8-sig",
        "latin-1",
        "cp1252",
        "iso-8859-1",
        "utf-16",
        "utf-16le",
        "utf-16be",
    ]

    COMMON_DELIMITERS = [",", ";", "\t", "|", ":"]

    @classmethod
    def detect_encoding(cls, file_bytes: bytes) -> str:
        """Auto-detect character encoding using charset_normalizer with fallback array."""
        if charset_normalizer:
            try:
                res = charset_normalizer.detect(file_bytes[:32000])
                encoding = res.get("encoding")
                if encoding:
                    return encoding
            except Exception as e:
                logger.debug(f"charset_normalizer failed: {e}")

        # Try decoding with known encodings
        for enc in cls.SUPPORTED_ENCODINGS:
            try:
                file_bytes.decode(enc)
                return enc
            except UnicodeDecodeError:
                continue

        return "utf-8"

    @classmethod
    def sniff_delimiter(cls, text_sample: str) -> str:
        """Autodetect CSV delimiter using csv.Sniffer or line frequency analysis."""
        lines = [line.strip() for line in text_sample.splitlines() if line.strip()][:15]
        if not lines:
            return ","

        sample_str = "\n".join(lines)
        try:
            sniffer = csv.Sniffer()
            dialect = sniffer.sniff(sample_str, delimiters=";,|\t:")
            if dialect.delimiter:
                return dialect.delimiter
        except Exception:
            pass

        # Fallback: Count delimiter occurrences per line across candidates
        delimiter_counts: dict[str, int] = {}
        for delim in cls.COMMON_DELIMITERS:
            counts = [line.count(delim) for line in lines]
            if counts and max(counts) > 0 and len(set(counts)) <= 3:
                delimiter_counts[delim] = sum(counts)

        if delimiter_counts:
            return max(delimiter_counts, key=delimiter_counts.get)  # type: ignore

        return ","

    @classmethod
    def sanitize_column_names(cls, original_cols: list[Any]) -> list[str]:
        """
        Sanitize column names:
        - Handle missing/Unnamed headers by assigning default names
        - Strip special characters, convert spaces/dashes to underscores
        - Ensure unique names by appending numeric suffixes to duplicate columns
        """
        clean_names: list[str] = []
        seen: dict[str, int] = {}

        for idx, orig in enumerate(original_cols):
            val = str(orig).strip()
            # If missing header or Unnamed pandas auto-header
            if not val or val.lower().startswith("unnamed:") or val.lower() == "none" or val.lower() == "null":
                base_name = f"col_{idx + 1}"
            else:
                # Remove special characters like $, %, @, #, (, ), etc., replace space/dash with underscore, lowercase
                clean = re.sub(r'[^\w\s\-]', '', val).lower()
                clean = re.sub(r'[\s\-]+', '_', clean).strip('_')
                base_name = clean if clean else f"col_{idx + 1}"

            # Handle duplicate column names
            if base_name in seen:
                count = seen[base_name]
                seen[base_name] += 1
                unique_name = f"{base_name}_{count}"
            else:
                seen[base_name] = 1
                unique_name = base_name

            clean_names.append(unique_name)

        return clean_names

    @classmethod
    def clean_formatted_values(cls, df: pd.DataFrame) -> pd.DataFrame:
        """
        Regex-based data cleaning for object/string columns:
        - Removes currency symbols ($, €, £, ¥, ₹)
        - Removes percentage signs (%) and thousand separators (commas)
        - Converts negative parentheses e.g. (1,230.50) to -1230.50
        - Attempts conversion to float/int if all values match numeric pattern
        """
        df = df.copy()

        # Match formatted numbers e.g. "$1,234.50", "€ 95.5%", "£(500.00)", "12.5%"
        currency_pct_pattern = re.compile(
            r'^\s*[\$\€\£\¥\₹]?\s*\(?\s*[\d,]+(\.\d+)?\s*%\s*\)?\s*$|^\s*[\$\€\£\¥\₹]?\s*\(?\s*[\d,]+(\.\d+)?\s*\)?\s*$'
        )

        for col in df.select_dtypes(include=['object', 'string']).columns:
            non_null = df[col].dropna().astype(str).str.strip()
            if len(non_null) == 0:
                continue

            # Check if majority (>60%) of non-null string values look like formatted numbers
            match_count = sum(1 for val in non_null if currency_pct_pattern.match(val))
            if match_count / len(non_null) >= 0.6:
                cleaned_series = df[col].astype(str).apply(cls._clean_numeric_string)
                numeric_converted = pd.to_numeric(cleaned_series, errors='coerce')
                # If conversion yielded valid numeric data for majority, replace column
                if numeric_converted.dropna().count() / len(non_null) >= 0.6:
                    df[col] = numeric_converted

        return df

    @staticmethod
    def _clean_numeric_string(val: str) -> Any:
        if not val or val.lower() in ("nan", "none", "null", "n/a", ""):
            return None
        val_str = str(val).strip()
        # Handle parentheses negative e.g. (123.45) -> -123.45
        is_negative = False
        if val_str.startswith("(") and val_str.endswith(")"):
            is_negative = True
            val_str = val_str[1:-1].strip()

        # Remove currency symbols, %, and commas
        cleaned = re.sub(r'[\$\€\£\¥\₹\,\%\s]', '', val_str)
        if not cleaned:
            return None

        try:
            num = float(cleaned)
            return -num if is_negative else num
        except ValueError:
            return val

    @classmethod
    def read_to_pandas(cls, file_bytes: bytes, filename: str) -> pd.DataFrame:
        """
        Full resilient pipeline:
        1. Autodetect encoding
        2. Sniff delimiter / file format (CSV vs Excel)
        3. Parse into DataFrame
        4. Sanitize headers & resolve duplicates
        5. Clean formatted values (currencies, percentages)
        """
        ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''

        if ext in ('xlsx', 'xls'):
            try:
                df = pd.read_excel(io.BytesIO(file_bytes))
            except Exception as e:
                logger.error(f"Excel parse error for {filename}: {e}")
                raise ValueError(f"Failed to parse Excel file: {str(e)}")
        else:
            # CSV / Text file parsing
            encoding = cls.detect_encoding(file_bytes)
            try:
                decoded_text = file_bytes.decode(encoding)
            except Exception:
                decoded_text = file_bytes.decode("latin-1", errors="replace")

            delimiter = cls.sniff_delimiter(decoded_text)

            try:
                df = pd.read_csv(
                    io.StringIO(decoded_text),
                    sep=delimiter,
                    on_bad_lines="skip",
                    engine="python"
                )
            except Exception as e:
                logger.warning(f"Python CSV engine failed for {filename}: {e}. Retrying standard C engine.")
                df = pd.read_csv(
                    io.BytesIO(file_bytes),
                    encoding=encoding,
                    sep=delimiter,
                    on_bad_lines="skip"
                )

        # Apply Header Cleanliness & Duplicate Handling
        df.columns = cls.sanitize_column_names(list(df.columns))

        # Apply Value Format Cleaning
        df = cls.clean_formatted_values(df)

        return df

    @classmethod
    def read_to_polars(cls, file_bytes: bytes, filename: str) -> pl.DataFrame:
        """
        Polars wrapper using the resilient Pandas pipeline for maximum safety.
        """
        pdf = cls.read_to_pandas(file_bytes, filename)
        return pl.from_pandas(pdf)
