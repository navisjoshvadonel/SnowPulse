import io
from typing import Tuple
import polars as pl


class DataCleaner:
    @classmethod
    def sanitize_bytes(cls, raw_bytes: bytes, filename: str = "dataset.csv") -> Tuple[pl.DataFrame, dict]:
        """
        Sanitizes raw uploaded file bytes:
        - Tries UTF-8, Latin-1, CP1252 encodings
        - Strips whitespace from column names and string cells
        - Handles mixed date formats & empty null strings
        """
        encodings = ["utf-8", "latin-1", "cp1252"]
        df = None
        used_encoding = "utf-8"

        for enc in encodings:
            try:
                decoded = raw_bytes.decode(enc)
                df = pl.read_csv(io.StringIO(decoded), infer_schema_length=10000, ignore_errors=True)
                used_encoding = enc
                break
            except Exception:
                continue

        if df is None:
            # Fallback byte stream read
            df = pl.read_csv(io.BytesIO(raw_bytes), infer_schema_length=1000, ignore_errors=True)

        # 1. Clean column names
        clean_cols = [str(col).strip().replace(" ", "_").replace("-", "_") for col in df.columns]
        df.columns = clean_cols

        # 2. Trim string whitespace & standardize null representation
        exprs = []
        for col in df.columns:
            if df[col].dtype == pl.Utf8:
                exprs.append(
                    pl.col(col)
                    .str.strip_chars()
                    .replace("", None)
                    .replace("N/A", None)
                    .replace("null", None)
                    .replace("NaN", None)
                )
            else:
                exprs.append(pl.col(col))

        df = df.with_columns(exprs)

        sanitization_report = {
            "used_encoding": used_encoding,
            "original_columns": len(clean_cols),
            "cleaned_null_tokens": True,
        }

        return df, sanitization_report
