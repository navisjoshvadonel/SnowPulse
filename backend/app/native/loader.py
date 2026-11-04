"""
SnowPulse AI - Universal Native Dataset Loader.
Supports CSV, TSV, Parquet, JSON, JSONL, Excel, and SQLite.
Returns Polars DataFrames with optimized schema inference.
"""

import os
from pathlib import Path
from typing import Any
import polars as pl
import pandas as pd


def load_dataset(file_path: str | Path, **kwargs: Any) -> pl.DataFrame:
    """
    Universally loads a tabular dataset from disk into a Polars DataFrame.
    """
    path = Path(file_path).resolve()
    if not path.exists():
        raise FileNotFoundError(f"Dataset file not found: {path}")

    ext = path.suffix.lower()

    if ext in (".csv", ".txt", ".dat"):
        # Auto-detect delimiter
        try:
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                header = f.readline()
                if "\t" in header and "," not in header:
                    separator = "\t"
                elif ";" in header and "," not in header:
                    separator = ";"
                elif "|" in header and "," not in header:
                    separator = "|"
                else:
                    separator = ","
            return pl.read_csv(path, separator=separator, ignore_errors=True, **kwargs)
        except Exception:
            # Fallback to pandas with python engine
            pdf = pd.read_csv(path, sep=None, engine="python", on_bad_lines="skip")
            return pl.from_pandas(pdf)

    elif ext == ".tsv":
        return pl.read_csv(path, separator="\t", ignore_errors=True, **kwargs)

    elif ext in (".parquet", ".pq"):
        return pl.read_parquet(path, **kwargs)

    elif ext in (".json", ".jsonl"):
        try:
            return pl.read_ndjson(path, **kwargs)
        except Exception:
            return pl.read_json(path, **kwargs)

    elif ext in (".xlsx", ".xls"):
        # Convert Excel via pandas
        pdf = pd.read_excel(path, **kwargs)
        return pl.from_pandas(pdf)

    elif ext in (".db", ".sqlite", ".sqlite3"):
        # Read from SQLite
        table = kwargs.get("table")
        import sqlite3
        conn = sqlite3.connect(path)
        if not table:
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
            tables = cursor.fetchall()
            if not tables:
                conn.close()
                raise ValueError(f"No tables found in SQLite database: {path}")
            table = tables[0][0]
        pdf = pd.read_sql_query(f"SELECT * FROM {table}", conn)
        conn.close()
        return pl.from_pandas(pdf)

    else:
        # Fallback try read_csv
        return pl.read_csv(path, ignore_errors=True, **kwargs)

