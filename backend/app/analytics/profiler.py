import re
from typing import Any, Literal, Optional
import polars as pl
from pydantic import BaseModel, Field

ColumnRole = Literal["metric", "dimension", "temporal", "target", "identifier", "geo", "text"]

class ColumnProfile(BaseModel):
    name: str
    dtype: str
    inferred_role: ColumnRole
    null_percentage: float = Field(ge=0.0, le=100.0)
    cardinality: int
    numeric_stats: Optional[dict[str, Optional[float]]] = None
    top_values: Optional[list[dict[str, Any]]] = None
    temporal_stats: Optional[dict[str, str]] = None

class DatasetSchema(BaseModel):
    total_rows: int
    total_columns: int
    columns: list[ColumnProfile]

KNOWN_GEO_TERMS = {"country", "region", "city", "state", "lat", "latitude", "lon", "longitude", "zip", "postal", "geo", "location", "county", "province"}
KNOWN_GEO_VALUES = {"us", "usa", "uk", "gb", "ca", "de", "fr", "in", "cn", "jp", "au", "br", "apac", "emea", "latam", "na", "sa", "europe", "asia", "north america", "south america"}
KNOWN_TARGET_TERMS = {"target", "label", "class", "outcome", "y", "species", "purchased", "churn", "status", "survival", "survived", "disease"}
KNOWN_ID_TERMS = {"id", "uuid", "key", "code", "index", "hash", "ssn", "guid"}
KNOWN_TEMPORAL_TERMS = {"date", "time", "timestamp", "year", "month", "day", "created_at", "updated_at", "period"}

class DatasetProfiler:
    @classmethod
    def profile(cls, df: pl.DataFrame) -> DatasetSchema:
        total_rows = df.height
        total_columns = len(df.columns)
        col_profiles: list[ColumnProfile] = []

        for col_name in df.columns:
            series = df[col_name]
            dtype_str = str(series.dtype)
            col_lower = col_name.lower()

            null_count = series.null_count()
            null_pct = round((null_count / total_rows * 100.0) if total_rows > 0 else 0.0, 2)
            cardinality = series.n_unique()

            role = cls._infer_role(col_name, series, total_rows, cardinality)

            num_stats = None
            top_vals = None
            temp_stats = None

            is_numeric_type = series.dtype in [
                pl.Int8, pl.Int16, pl.Int32, pl.Int64,
                pl.UInt8, pl.UInt16, pl.UInt32, pl.UInt64,
                pl.Float32, pl.Float64
            ]

            if is_numeric_type and role in ["metric", "target", "dimension"]:
                num_stats = cls._calc_numeric_stats(series)

            if role in ["dimension", "target", "geo", "identifier"] or (not is_numeric_type and role != "temporal"):
                top_vals = cls._calc_top_values(series)

            if role == "temporal":
                temp_stats = cls._calc_temporal_stats(series)

            col_profiles.append(
                ColumnProfile(
                    name=col_name,
                    dtype=dtype_str,
                    inferred_role=role,
                    null_percentage=null_pct,
                    cardinality=cardinality,
                    numeric_stats=num_stats,
                    top_values=top_vals,
                    temporal_stats=temp_stats,
                )
            )

        return DatasetSchema(
            total_rows=total_rows,
            total_columns=total_columns,
            columns=col_profiles,
        )

    @classmethod
    def _infer_role(cls, name: str, series: pl.Series, total_rows: int, cardinality: int) -> ColumnRole:
        col_lower = name.lower()

        # 1. Identifier Check
        is_id_name = any(col_lower == term or col_lower.endswith(f"_{term}") or col_lower.startswith(f"{term}_") for term in KNOWN_ID_TERMS)
        is_near_unique = total_rows > 5 and (cardinality / total_rows) >= 0.95
        if is_id_name and (is_near_unique or cardinality > 10):
            return "identifier"

        # 2. Target / Class Check
        if any(col_lower == term or col_lower.endswith(f"_{term}") for term in KNOWN_TARGET_TERMS):
            return "target"

        # 3. Temporal Check
        if series.dtype in [pl.Date, pl.Datetime]:
            return "temporal"
        if any(term in col_lower for term in KNOWN_TEMPORAL_TERMS):
            if series.dtype == pl.Utf8:
                non_null = series.drop_nulls().head(50)
                if len(non_null) > 0:
                    try:
                        parsed = non_null.str.to_datetime(strict=False)
                        if parsed.null_count() < len(non_null) * 0.5:
                            return "temporal"
                    except Exception:
                        pass
            elif series.dtype in [pl.Int32, pl.Int64] and ("year" in col_lower or "date" in col_lower):
                return "temporal"

        # 4. Geo Check
        if any(term in col_lower for term in KNOWN_GEO_TERMS):
            return "geo"
        if series.dtype == pl.Utf8 and cardinality > 0:
            sample_vals = [str(v).lower() for v in series.drop_nulls().head(20).to_list()]
            if any(val in KNOWN_GEO_VALUES for val in sample_vals):
                return "geo"

        # 5. Text vs Dimension vs Metric
        is_numeric = series.dtype in [
            pl.Int8, pl.Int16, pl.Int32, pl.Int64,
            pl.UInt8, pl.UInt16, pl.UInt32, pl.UInt64,
            pl.Float32, pl.Float64
        ]

        if is_numeric:
            is_float = series.dtype in [pl.Float32, pl.Float64]
            if not is_float and cardinality <= 5 and not any(term in col_lower for term in ["amount", "revenue", "price", "val", "cost", "sum"]):
                return "dimension"
            return "metric"

        if series.dtype == pl.Utf8:
            non_null = series.drop_nulls().head(50)
            if len(non_null) > 0:
                avg_len = sum(len(str(v)) for v in non_null) / len(non_null)
                if avg_len > 60:
                    return "text"
            return "dimension"

        if is_near_unique:
            return "identifier"

        return "dimension"

    @classmethod
    def _calc_numeric_stats(cls, series: pl.Series) -> dict[str, Optional[float]]:
        clean_series = series.drop_nulls()
        if len(clean_series) == 0:
            return {"min": None, "max": None, "mean": None, "std": None, "skew": None, "outlier_count": 0.0}

        min_val = float(clean_series.min()) if clean_series.min() is not None else None
        max_val = float(clean_series.max()) if clean_series.max() is not None else None
        mean_val = float(clean_series.mean()) if clean_series.mean() is not None else None
        std_val = float(clean_series.std()) if clean_series.std() is not None else None

        skew_val = None
        try:
            if len(clean_series) >= 3 and std_val and std_val > 0:
                median_val = float(clean_series.median())
                skew_val = round(3.0 * (mean_val - median_val) / std_val, 2)
        except Exception:
            pass

        outlier_count = 0.0
        try:
            q25 = float(clean_series.quantile(0.25))
            q75 = float(clean_series.quantile(0.75))
            iqr = q75 - q25
            if iqr > 0:
                lower_b = q25 - 1.5 * iqr
                upper_b = q75 + 1.5 * iqr
                outlier_count = float(clean_series.filter((clean_series < lower_b) | (clean_series > upper_b)).len())
        except Exception:
            pass

        return {
            "min": round(min_val, 4) if min_val is not None else None,
            "max": round(max_val, 4) if max_val is not None else None,
            "mean": round(mean_val, 4) if mean_val is not None else None,
            "std": round(std_val, 4) if std_val is not None else None,
            "skew": skew_val,
            "outlier_count": outlier_count,
        }

    @classmethod
    def _calc_top_values(cls, series: pl.Series) -> list[dict[str, Any]]:
        clean_series = series.drop_nulls()
        if len(clean_series) == 0:
            return []
        try:
            vc = clean_series.value_counts().sort("count", descending=True).head(5)
            res = []
            for row in vc.iter_rows():
                res.append({"value": str(row[0]), "count": int(row[1])})
            return res
        except Exception:
            return []

    @classmethod
    def _calc_temporal_stats(cls, series: pl.Series) -> dict[str, str]:
        clean_series = series.drop_nulls()
        if len(clean_series) == 0:
            return {"min_date": "N/A", "max_date": "N/A", "granularity": "unknown"}
        try:
            if clean_series.dtype == pl.Utf8:
                parsed = clean_series.str.to_datetime(strict=False).drop_nulls()
            else:
                parsed = clean_series
            if len(parsed) > 0:
                min_d = str(parsed.min())
                max_d = str(parsed.max())
                return {"min_date": min_d, "max_date": max_d, "granularity": "daily"}
        except Exception:
            pass
        return {"min_date": str(clean_series.min()), "max_date": str(clean_series.max()), "granularity": "unknown"}
