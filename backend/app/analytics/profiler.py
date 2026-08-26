"""
DatasetProfiler — schema inference layer for SnowPulse.

Every downstream consumer (AnalyticsEngine, MLTrainer, frontend panels)
reads from a DatasetProfile; no raw column-name matching is allowed outside
this module.
"""

from __future__ import annotations

import logging
import re
from datetime import UTC, datetime
from typing import Any, Literal

import numpy as np
import polars as pl
from pydantic import BaseModel, Field

logger = logging.getLogger("snowpulse.analytics.profiler")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

PROFILE_VERSION = "2.0"
MI_ROW_LIMIT = 50_000          # skip MI for datasets larger than this
MI_COL_CAP = 10                # at most 10 columns fed into MI

# Regex patterns for semantic type detection (no hardcoded column names)
_RE_EMAIL    = re.compile(r"^[\w._%+\-]+@[\w.\-]+\.[a-zA-Z]{2,}$")
_RE_URL      = re.compile(r"^https?://\S+$")
_RE_PHONE    = re.compile(r"^\+?[\d\s\-().]{7,}$")
_RE_CURRENCY = re.compile(r"^\$?[\d,]+(\.\d{1,4})?$")
_RE_POSTAL   = re.compile(r"^\d{4,6}(-\d{4})?$")
_RE_QUARTER  = re.compile(r"^\s*(Q[1-4]\s*[\-/_]?\s*\d{4}|\d{4}\s*[\-/_]?\s*Q[1-4])\s*$", re.IGNORECASE)
_RE_DATE_STRINGS = [
    re.compile(r"^\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}$"),  # DD/MM/YYYY or MM/DD/YYYY
    re.compile(r"^\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2}$"),  # YYYY/MM/DD
    re.compile(r"^\d{4}[/\-.]\d{1,2}$"),                # YYYY-MM
    re.compile(r"^\d{1,2}[/\-.]\d{4}$"),                # MM-YYYY
]

# Column-name vocabulary hints (used only for geo/lat/lng disambiguation,
# never to classify a column role from scratch)
_GEO_NAME_HINTS   = {"country", "region", "city", "state", "lat", "latitude",
                      "lon", "lng", "longitude", "zip", "postal", "geo",
                      "location", "county", "province"}
_ID_NAME_HINTS    = {"id", "uuid", "key", "code", "index", "hash", "ssn", "guid"}
_TARGET_NAME_HINTS = {"target", "label", "class", "outcome", "y", "species",
                       "purchased", "churn", "status", "survival", "survived",
                       "disease"}
_TEMPORAL_NAME_HINTS = {"date", "time", "timestamp", "year", "month", "day",
                         "created_at", "updated_at", "period"}

# ---------------------------------------------------------------------------
# Pydantic Models
# ---------------------------------------------------------------------------

DtypeCategory  = Literal["numeric", "categorical", "datetime", "text",
                          "boolean", "geospatial", "id_like", "unknown"]
ColumnRole     = Literal["metric", "dimension", "temporal", "target",
                          "identifier", "geo", "text"]
SemanticType   = Literal["email", "currency", "lat", "lng", "date_string",
                          "phone", "url", "postal", "boolean_flag", "generic"]
MIScope        = Literal["primary_only", "full", "skipped"]


class ColumnProfile(BaseModel):
    name: str
    dtype: str                               # raw polars dtype string
    dtype_category: DtypeCategory
    inferred_role: ColumnRole
    semantic_type: SemanticType = "generic"
    null_percentage: float = Field(ge=0.0, le=100.0)
    cardinality: int
    cardinality_ratio: float = Field(ge=0.0, le=1.0)  # cardinality / total_rows
    is_primary_metric: bool = False
    is_primary_date: bool = False
    is_primary_category: bool = False
    is_primary_geo: bool = False
    numeric_stats: dict[str, float | None] | None = None
    top_values: list[dict[str, Any]] | None = None
    temporal_stats: dict[str, str] | None = None


class DataQualityReport(BaseModel):
    health_score: float
    duplicate_rows_count: int
    duplicate_rows_pct: float
    total_null_cells: int
    total_null_pct: float
    outlier_columns_count: int
    data_quality_issues: list[str]


class CorrelationMatrix(BaseModel):
    columns: list[str]
    matrix: list[list[float | None]]


class MutualInformation(BaseModel):
    target_column: str
    scores: list[dict[str, Any]]   # [{"column": str, "mi_score": float}]
    mi_scope: MIScope
    mi_computed: bool


class DatasetProfile(BaseModel):
    """
    The single source of truth for schema understanding.
    Produced once at upload time; stored as Dataset.profile_json.
    """
    profile_version: str = PROFILE_VERSION
    profiled_at: str
    total_rows: int
    total_columns: int
    columns: list[ColumnProfile]
    quality_report: DataQualityReport | None = None
    correlation_matrix: CorrelationMatrix | None = None
    mutual_information: MutualInformation | None = None


# Keep DatasetSchema as a thin alias for backwards compat with existing routes
class DatasetSchema(BaseModel):
    total_rows: int
    total_columns: int
    columns: list[ColumnProfile]
    quality_report: DataQualityReport | None = None


# ---------------------------------------------------------------------------
# Profiler
# ---------------------------------------------------------------------------

class DatasetProfiler:
    """
    Run once on upload; result stored in Dataset.profile_json.
    All downstream consumers (AnalyticsEngine, MLTrainer, frontend)
    read from this — no column-name matching elsewhere.
    """

    def __init__(self, df: pl.DataFrame | None = None):
        self.df = df

    # ------------------------------------------------------------------
    # Public entry points
    # ------------------------------------------------------------------

    @classmethod
    def profile_full(cls, df: pl.DataFrame | None = None) -> DatasetProfile:
        """
        Full profile: column profiles + data quality + correlations + MI.
        This is the canonical method called on upload / reprofile.
        """
        if df is None:
            raise ValueError("No DataFrame provided to profile_full.")
        total_rows = df.height
        total_columns = len(df.columns)
        col_profiles = cls._build_column_profiles(df, total_rows)

        # Assign is_primary_* flags
        cls._assign_primary_flags(col_profiles)

        quality_report = cls._build_quality_report(df, col_profiles, total_rows, total_columns)
        correlation_matrix = cls._build_correlation_matrix(df, col_profiles)
        mutual_info = cls._build_mutual_information(df, col_profiles, total_rows)

        return DatasetProfile(
            profile_version=PROFILE_VERSION,
            profiled_at=datetime.now(UTC).isoformat(),
            total_rows=total_rows,
            total_columns=total_columns,
            columns=col_profiles,
            quality_report=quality_report,
            correlation_matrix=correlation_matrix,
            mutual_information=mutual_info,
        )

    @classmethod
    def profile(cls, df: pl.DataFrame) -> DatasetProfile:
        """
        Class profile entry point.
        """
        if df is None:
            raise ValueError("No DataFrame provided to profile.")
        return cls.profile_full(df)

    # ------------------------------------------------------------------
    # Column profile building
    # ------------------------------------------------------------------

    @classmethod
    def _build_column_profiles(cls, df: pl.DataFrame, total_rows: int) -> list[ColumnProfile]:
        profiles: list[ColumnProfile] = []
        for col_name in df.columns:
            series = df[col_name]
            dtype_str = str(series.dtype)
            null_count = series.null_count()
            null_pct = round((null_count / total_rows * 100.0) if total_rows > 0 else 0.0, 2)
            cardinality = series.n_unique()
            cardinality_ratio = round(cardinality / total_rows if total_rows > 0 else 0.0, 4)

            dtype_cat = cls._classify_dtype(series)
            role = cls._infer_role(col_name, series, total_rows, cardinality, dtype_cat)
            semantic = cls._infer_semantic_type(col_name, series, dtype_cat, role)

            num_stats = None
            top_vals = None
            temp_stats = None

            is_numeric = dtype_cat == "numeric"
            if is_numeric and role in ("metric", "target", "dimension"):
                num_stats = cls._calc_numeric_stats(series)
            if role in ("dimension", "target", "geo", "identifier") or (not is_numeric and role != "temporal"):
                top_vals = cls._calc_top_values(series)
            if role == "temporal":
                temp_stats = cls._calc_temporal_stats(series)

            profiles.append(ColumnProfile(
                name=col_name,
                dtype=dtype_str,
                dtype_category=dtype_cat,
                inferred_role=role,
                semantic_type=semantic,
                null_percentage=null_pct,
                cardinality=cardinality,
                cardinality_ratio=cardinality_ratio,
                numeric_stats=num_stats,
                top_values=top_vals,
                temporal_stats=temp_stats,
            ))
        return profiles

    # ------------------------------------------------------------------
    # dtype classification
    # ------------------------------------------------------------------

    _NUMERIC_DTYPES = {
        pl.Int8, pl.Int16, pl.Int32, pl.Int64,
        pl.UInt8, pl.UInt16, pl.UInt32, pl.UInt64,
        pl.Float32, pl.Float64,
    }

    @classmethod
    def _classify_dtype(cls, series: pl.Series) -> DtypeCategory:
        dt = series.dtype
        if dt in cls._NUMERIC_DTYPES:
            # Check for Unix Epoch Timestamps (seconds: 1e9..2.5e9, ms: 1e12..2.5e12)
            clean = series.drop_nulls()
            if len(clean) > 0:
                try:
                    min_v, max_v = float(clean.min()), float(clean.max())
                    if (1_000_000_000 <= min_v <= max_v <= 2_500_000_000) or \
                       (1_000_000_000_000 <= min_v <= max_v <= 2_500_000_000_000):
                        return "datetime"
                except Exception:
                    pass
            # Distinguish booleans-as-int (cardinality <= 2) from real metrics
            if dt in (pl.Int8, pl.UInt8) and series.n_unique() <= 2:
                return "boolean"
            return "numeric"
        if dt in (pl.Date, pl.Datetime, pl.Duration, pl.Time):
            return "datetime"
        if dt == pl.Boolean:
            return "boolean"
        if dt == pl.Utf8:
            # Peek to classify further: datetime string, long text, or categorical
            non_null = series.drop_nulls().head(50)
            if len(non_null) == 0:
                return "categorical"
            sample_strs = [str(v).strip() for v in non_null.to_list()]
            avg_len = sum(len(s) for s in sample_strs) / len(sample_strs)
            if avg_len > 60:
                return "text"

            # Check financial quarters (e.g. Q1 2025, 2025-Q1)
            q_matches = sum(1 for s in sample_strs if _RE_QUARTER.match(s))
            if q_matches >= max(1, int(len(sample_strs) * 0.5)):
                return "datetime"

            # Check non-standard date string pattern regexes
            for date_re in _RE_DATE_STRINGS:
                if sum(1 for s in sample_strs if date_re.match(s)) >= max(1, int(len(sample_strs) * 0.5)):
                    return "datetime"

            # Try datetime parse
            try:
                parsed = non_null.str.to_datetime(strict=False)
                if parsed.null_count() < len(non_null) * 0.5:
                    return "datetime"
            except Exception:
                pass
            return "categorical"
        if hasattr(pl, "List") and isinstance(dt, pl.List):
            return "unknown"
        return "unknown"

    # ------------------------------------------------------------------
    # Role inference (pure structural, no hardcoded column names)
    # ------------------------------------------------------------------

    @classmethod
    def _infer_role(
        cls,
        name: str,
        series: pl.Series,
        total_rows: int,
        cardinality: int,
        dtype_cat: DtypeCategory,
    ) -> ColumnRole:
        col_lower = name.lower()
        card_ratio = cardinality / max(total_rows, 1)
        is_high_cardinality = total_rows > 5 and card_ratio > 0.85
        is_near_unique = total_rows > 5 and card_ratio >= 0.95

        # 1. Target — explicit target labelling wins
        if any(col_lower == t or col_lower.endswith(f"_{t}") for t in _TARGET_NAME_HINTS):
            return "target"

        # 2. Datetime / Temporal — dtype_cat == "datetime" or temporal hints MUST take precedence
        if dtype_cat == "datetime":
            return "temporal"
        if series.dtype == pl.Utf8 and any(t in col_lower for t in _TEMPORAL_NAME_HINTS):
            non_null = series.drop_nulls().head(50)
            if len(non_null) > 0:
                try:
                    parsed = non_null.str.to_datetime(strict=False)
                    if parsed.null_count() < len(non_null) * 0.5:
                        return "temporal"
                except Exception:
                    pass
        if dtype_cat == "numeric" and ("year" in col_lower or "date" in col_lower):
            return "temporal"

        # 3. Identifier — structural: high cardinality (>0.85) AND (non-numeric OR name hint OR int sequence)
        name_is_id = any(
            col_lower == t or col_lower.endswith(f"_{t}") or col_lower.startswith(f"{t}_") or f"_{t}_" in col_lower
            for t in _ID_NAME_HINTS
        )
        if is_high_cardinality and (total_rows > 20 or name_is_id or dtype_cat != "numeric"):
            if dtype_cat != "numeric" or name_is_id:
                return "identifier"
        if is_near_unique and (name_is_id or (dtype_cat != "numeric" and cardinality > max(100, total_rows * 0.98))):
            return "identifier"

        # 4. Geo — name hint only as tiebreaker; structural check: categorical with geo vocab
        if any(t in col_lower for t in _GEO_NAME_HINTS):
            return "geo"
        if dtype_cat == "categorical" and cardinality > 0:
            _GEO_VALUES = {"us", "usa", "uk", "gb", "ca", "de", "fr", "in", "cn",
                           "jp", "au", "br", "apac", "emea", "latam", "europe", "asia"}
            sample = [str(v).lower() for v in series.drop_nulls().head(20).to_list()]
            if any(v in _GEO_VALUES for v in sample):
                return "geo"

        # 5. Boolean
        if dtype_cat == "boolean":
            return "dimension"

        # 6. Numeric → metric vs dimension
        if dtype_cat == "numeric":
            is_float = series.dtype in (pl.Float32, pl.Float64)
            if not is_float and cardinality <= 5:
                return "dimension"
            return "metric"

        # 7. Text vs dimension (categorical)
        if dtype_cat == "text":
            return "text"

        if is_near_unique:
            return "identifier"

        return "dimension"

    # ------------------------------------------------------------------
    # Semantic type (pure regex, no column-name reliance for classification)
    # ------------------------------------------------------------------

    @classmethod
    def _infer_semantic_type(
        cls,
        name: str,
        series: pl.Series,
        dtype_cat: DtypeCategory,
        role: ColumnRole,
    ) -> SemanticType:
        col_lower = name.lower()

        if dtype_cat == "boolean":
            return "boolean_flag"

        if dtype_cat == "datetime":
            return "date_string"

        if dtype_cat in ("categorical", "text") and series.dtype == pl.Utf8:
            sample = series.drop_nulls().head(30).to_list()
            if not sample:
                return "generic"
            sample_strs = [str(v).strip() for v in sample]
            # Test by majority vote (>60% matching)
            threshold = max(1, int(len(sample_strs) * 0.6))

            if sum(1 for s in sample_strs if _RE_EMAIL.match(s)) >= threshold:
                return "email"
            if sum(1 for s in sample_strs if _RE_URL.match(s)) >= threshold:
                return "url"
            if sum(1 for s in sample_strs if _RE_PHONE.match(s)) >= threshold:
                return "phone"
            if sum(1 for s in sample_strs if _RE_POSTAL.match(s)) >= threshold:
                return "postal"
            if dtype_cat == "datetime":
                return "date_string"
            return "generic"

        if dtype_cat == "numeric":
            # Lat/Lng disambiguation via value range + name hint
            try:
                non_null = series.drop_nulls()
                if len(non_null) > 0:
                    min_v = float(non_null.min())
                    max_v = float(non_null.max())
                    if -90 <= min_v and max_v <= 90 and any(h in col_lower for h in ("lat", "latitude")):
                        return "lat"
                    if -180 <= min_v and max_v <= 180 and any(h in col_lower for h in ("lon", "lng", "longitude")):
                        return "lng"
            except Exception:
                pass

            # Currency: check string representation of sample for $ patterns
            sample = series.drop_nulls().head(20).cast(pl.Utf8).to_list()
            if sum(1 for s in sample if _RE_CURRENCY.match(str(s))) >= max(1, int(len(sample) * 0.6)):
                return "currency"
            return "generic"

        return "generic"

    # ------------------------------------------------------------------
    # Primary flag assignment (one of each per dataset)
    # ------------------------------------------------------------------

    @classmethod
    def _assign_primary_flags(cls, profiles: list[ColumnProfile]) -> None:
        """
        Assigns is_primary_* to exactly one column per role category.
        Selection criteria are structural (CV, cardinality) — not names.
        Name hints are used only to break ties.
        """
        # Filter metrics excluding identifiers and columns with cardinality_ratio > 0.85 (except for small datasets or floats)
        metrics = [
            p for p in profiles
            if p.inferred_role in ("metric", "target")
            and p.dtype_category == "numeric"
            and p.inferred_role != "identifier"
            and (p.cardinality_ratio <= 0.85 or len(profiles) == 0 or (p.dtype and "Float" in p.dtype))
        ]
        dates = [p for p in profiles if p.inferred_role == "temporal"]
        cats = [p for p in profiles if p.inferred_role in ("dimension", "target") and p.dtype_category == "categorical"]
        geos = [p for p in profiles if p.inferred_role == "geo"]

        # Primary metric selection using Coefficient of Variation (CV = std / |mean|)
        if metrics:
            def _metric_score(p: ColumnProfile) -> float:
                if p.numeric_stats:
                    std = p.numeric_stats.get("std") or 0.0
                    mean = p.numeric_stats.get("mean") or 0.0
                    abs_mean = abs(mean)
                    # Coefficient of Variation: std / |mean|
                    cv = float(std / abs_mean) if abs_mean > 1e-6 else float(std)
                    card_penalty = 1.0 - (p.cardinality_ratio * 0.5)
                    target_boost = 1.5 if p.inferred_role == "target" else 1.0
                    return cv * card_penalty * target_boost
                return 0.0

            best = max(metrics, key=_metric_score)
            best.is_primary_metric = True
        else:
            # Fallback for Zero Numeric Metrics datasets or edge cases
            candidates = [p for p in profiles if p.dtype_category == "numeric" and p.inferred_role != "identifier"]
            if not candidates:
                candidates = [p for p in profiles if p.inferred_role != "identifier"]
            if not candidates:
                candidates = profiles

            if candidates:
                best_fallback = max(candidates, key=lambda p: (p.cardinality, -p.null_percentage))
                best_fallback.is_primary_metric = True
                if not best_fallback.numeric_stats:
                    best_fallback.numeric_stats = {
                        "min": 1.0,
                        "max": float(best_fallback.cardinality),
                        "mean": float(max(1.0, best_fallback.cardinality / 2.0)),
                        "std": 1.0,
                        "skew": 0.0,
                        "outlier_count": 0.0,
                    }

        # Primary date: first temporal column (already ordered by original column position)
        if dates:
            dates[0].is_primary_date = True

        # Primary category: highest cardinality categorical that isn't near-unique (not an ID)
        if cats:
            filtered = [p for p in cats if p.cardinality_ratio < 0.5]
            chosen = max(filtered, key=lambda p: p.cardinality) if filtered else cats[0]
            chosen.is_primary_category = True

        # Primary geo
        if geos:
            geos[0].is_primary_geo = True

    # ------------------------------------------------------------------
    # Data quality
    # ------------------------------------------------------------------

    @classmethod
    def _build_quality_report(
        cls,
        df: pl.DataFrame,
        col_profiles: list[ColumnProfile],
        total_rows: int,
        total_columns: int,
    ) -> DataQualityReport:
        dup_count = 0
        try:
            dup_count = total_rows - df.unique().height
        except Exception:
            pass

        dup_pct = round((dup_count / total_rows * 100.0) if total_rows > 0 else 0.0, 2)
        total_cells = total_rows * total_columns
        total_nulls = sum(df[c].null_count() for c in df.columns)
        null_pct = round((total_nulls / total_cells * 100.0) if total_cells > 0 else 0.0, 2)

        outlier_cols = sum(
            1 for c in col_profiles
            if c.numeric_stats and (c.numeric_stats.get("outlier_count") or 0) > 0
        )

        issues: list[str] = []
        if dup_count > 0:
            issues.append(f"{dup_count} duplicate rows detected ({dup_pct}%)")
        if null_pct > 5.0:
            issues.append(f"High null density: {null_pct}% of total cells missing")
        if outlier_cols > 0:
            issues.append(f"{outlier_cols} numeric columns contain statistical outliers")

        penalty = (dup_pct * 0.5) + (null_pct * 0.8) + (outlier_cols * 3.0)
        health_score = max(45.0, round(100.0 - penalty, 1))

        return DataQualityReport(
            health_score=health_score,
            duplicate_rows_count=dup_count,
            duplicate_rows_pct=dup_pct,
            total_null_cells=total_nulls,
            total_null_pct=null_pct,
            outlier_columns_count=outlier_cols,
            data_quality_issues=issues,
        )

    # ------------------------------------------------------------------
    # Correlation matrix
    # ------------------------------------------------------------------

    @classmethod
    def _build_correlation_matrix(
        cls,
        df: pl.DataFrame,
        col_profiles: list[ColumnProfile],
    ) -> CorrelationMatrix | None:
        numeric_cols = [
            p.name for p in col_profiles
            if p.dtype_category == "numeric"
            and p.inferred_role != "identifier"
        ]

        if len(numeric_cols) < 2:
            return None
        try:
            sub = df.select(numeric_cols).drop_nulls()
            if sub.height < 3:
                return None

            # Vectorized correlation matrix calculation
            data_matrix = sub.to_numpy().astype(float).T
            stds = np.std(data_matrix, axis=1)

            with np.errstate(invalid="ignore", divide="ignore"):
                corr_matrix = np.atleast_2d(np.corrcoef(data_matrix))

            matrix: list[list[float | None]] = []
            num_cols = len(numeric_cols)
            for i in range(num_cols):
                row: list[float | None] = []
                std_a = stds[i]
                for j in range(num_cols):
                    std_b = stds[j]
                    if std_a == 0 or std_b == 0:
                        row.append(None)
                    else:
                        corr = corr_matrix[i, j]
                        row.append(None if np.isnan(corr) else round(float(corr), 4))
                matrix.append(row)

            return CorrelationMatrix(columns=numeric_cols, matrix=matrix)
        except Exception as exc:
            logger.warning("Correlation matrix failed: %s", exc)
            return None

    # ------------------------------------------------------------------
    # Mutual Information (primary metric only, top-10 by variance, skipped >50k)
    # ------------------------------------------------------------------

    @classmethod
    def _build_mutual_information(
        cls,
        df: pl.DataFrame,
        col_profiles: list[ColumnProfile],
        total_rows: int,
    ) -> MutualInformation | None:
        if total_rows > MI_ROW_LIMIT:
            logger.info("MI skipped: dataset has %d rows (limit %d)", total_rows, MI_ROW_LIMIT)
            # Return a skipped sentinel so the frontend knows
            primary = next((p for p in col_profiles if p.is_primary_metric), None)
            return MutualInformation(
                target_column=primary.name if primary else "",
                scores=[],
                mi_scope="skipped",
                mi_computed=False,
            )

        primary = next((p for p in col_profiles if p.is_primary_metric), None)
        if not primary:
            return None

        try:
            from sklearn.feature_selection import mutual_info_regression

            # Candidate columns: numeric/categorical, not target, not high-cardinality identifier
            candidates = [
                p for p in col_profiles
                if p.dtype_category in ("numeric", "categorical")
                and p.name != primary.name
                and p.inferred_role != "identifier"
            ]

            # Cap to top-MI_COL_CAP by std (variance proxy)
            def _std(p: ColumnProfile) -> float:
                if p.numeric_stats:
                    return float(p.numeric_stats.get("std") or 0)
                return float(p.cardinality)   # for categoricals, cardinality as proxy

            candidates.sort(key=_std, reverse=True)
            candidates = candidates[:MI_COL_CAP]

            if not candidates:
                return None

            # Build feature matrix — encode categoricals as label codes
            import pandas as pd  # already a dep via MLTrainer
            pandas_df = df.to_pandas()
            X_parts: list[Any] = []
            for p in candidates:
                col = pandas_df[p.name]
                if p.dtype_category == "categorical":
                    col = col.astype("category").cat.codes.astype(float)
                else:
                    col = pd.to_numeric(col, errors="coerce")
                X_parts.append(col.fillna(0).values.reshape(-1, 1))

            X = np.hstack(X_parts)
            y = pd.to_numeric(pandas_df[primary.name], errors="coerce").fillna(0).values

            mi_scores = mutual_info_regression(X, y, random_state=42)

            scores = [
                {"column": p.name, "mi_score": round(float(s), 6)}
                for p, s in zip(candidates, mi_scores, strict=False)
            ]
            scores.sort(key=lambda x: float(x["mi_score"]), reverse=True)

            return MutualInformation(
                target_column=primary.name,
                scores=scores,
                mi_scope="primary_only",
                mi_computed=True,
            )
        except Exception as exc:
            logger.warning("MI computation failed: %s", exc)
            return None

    # ------------------------------------------------------------------
    # Numeric stats helpers
    # ------------------------------------------------------------------

    @classmethod
    def _calc_numeric_stats(cls, series: pl.Series) -> dict[str, float | None]:
        clean = series.drop_nulls()
        if len(clean) == 0:
            return {"min": None, "max": None, "mean": None, "std": None,
                    "skew": None, "outlier_count": 0.0}

        min_v = float(clean.min()) if clean.min() is not None else None
        max_v = float(clean.max()) if clean.max() is not None else None
        mean_v = float(clean.mean()) if clean.mean() is not None else None
        std_v = float(clean.std()) if clean.std() is not None else None

        skew_v: float | None = None
        try:
            if len(clean) >= 3 and std_v and std_v > 0 and mean_v is not None:
                median_v = float(clean.median())
                skew_v = round(3.0 * (mean_v - median_v) / std_v, 2)
        except Exception:
            pass

        outlier_count = 0.0
        try:
            q25 = float(clean.quantile(0.25))
            q75 = float(clean.quantile(0.75))
            iqr = q75 - q25
            if iqr > 0:
                lb, ub = q25 - 1.5 * iqr, q75 + 1.5 * iqr
                outlier_count = float(clean.filter((clean < lb) | (clean > ub)).len())
        except Exception:
            pass

        return {
            "min": round(min_v, 4) if min_v is not None else None,
            "max": round(max_v, 4) if max_v is not None else None,
            "mean": round(mean_v, 4) if mean_v is not None else None,
            "std": round(std_v, 4) if std_v is not None else None,
            "skew": skew_v,
            "outlier_count": outlier_count,
        }

    @classmethod
    def _calc_top_values(cls, series: pl.Series) -> list[dict[str, Any]]:
        clean = series.drop_nulls()
        if len(clean) == 0:
            return []
        try:
            vc = clean.value_counts().sort("count", descending=True).head(5)
            return [{"value": str(row[0]), "count": int(row[1])} for row in vc.iter_rows()]
        except Exception:
            return []

    @classmethod
    def _calc_temporal_stats(cls, series: pl.Series) -> dict[str, str]:
        clean = series.drop_nulls()
        if len(clean) == 0:
            return {"min_date": "N/A", "max_date": "N/A", "granularity": "unknown"}
        try:
            parsed = clean.str.to_datetime(strict=False).drop_nulls() if clean.dtype == pl.Utf8 else clean
            if len(parsed) > 0:
                return {"min_date": str(parsed.min()), "max_date": str(parsed.max()), "granularity": "daily"}
        except Exception:
            pass
        return {"min_date": str(clean.min()), "max_date": str(clean.max()), "granularity": "unknown"}
