"""
AnalyticsEngine — reads column roles from a DatasetProfile.
No column-name keyword matching. If no profile is available,
falls back to inline profiling (logs a warning so stale datasets
can be tracked and backfilled).
"""

from __future__ import annotations

import io
import logging
import os
from typing import Any, Optional

import numpy as np
import polars as pl

from ..analytics.profiler import DatasetProfile, DatasetProfiler
from ..storage.service import storage_service

logger = logging.getLogger("snowpulse.analytics.engine")


def _load_df(file_path: str) -> pl.DataFrame:
    """Read a polars DataFrame from MinIO or local disk."""
    if file_path.startswith("minio://"):
        parts = file_path.replace("minio://", "").split("/", 1)
        file_bytes = storage_service.get_file(parts[0], parts[1])
        return pl.read_csv(io.BytesIO(file_bytes))

    resolved = file_path
    if not os.path.exists(resolved):
        backend_path = os.path.join("backend", file_path)
        if os.path.exists(backend_path):
            resolved = backend_path
        else:
            raise FileNotFoundError(f"Dataset file not found at {file_path}")
    return pl.read_csv(resolved)


class AnalyticsEngine:
    """
    Computes KPIs, trends, geo distributions, anomalies, and correlations
    for a single dataset. Column roles are read from a DatasetProfile;
    this class never performs its own column-name heuristics.
    """

    def __init__(self, file_path: str, profile: Optional[DatasetProfile] = None):
        self.file_path = file_path
        self.df = _load_df(file_path)
        self.headers = self.df.columns
        self.num_rows = self.df.height

        # Obtain a DatasetProfile — either passed in (fast path) or computed inline
        if profile is not None:
            self._profile = profile
        else:
            logger.warning(
                "analytics.engine.fallback_profile file=%s — "
                "no stored profile found; computing inline. "
                "Consider running /api/datasets/{id}/reprofile to persist a profile.",
                os.path.basename(file_path),
            )
            self._profile = DatasetProfiler.profile_full(self.df)

        # Extract canonical column references from profile flags
        self.metric_col: Optional[str] = next(
            (c.name for c in self._profile.columns if c.is_primary_metric), None
        )
        self.date_col: Optional[str] = next(
            (c.name for c in self._profile.columns if c.is_primary_date), None
        )
        self.category_col: Optional[str] = next(
            (c.name for c in self._profile.columns if c.is_primary_category), None
        )
        self.geo_col: Optional[str] = next(
            (c.name for c in self._profile.columns if c.is_primary_geo), None
        )

        # All numeric / categorical column lists (for downstream consumers)
        self.numeric_cols: list[str] = [
            c.name for c in self._profile.columns if c.dtype_category == "numeric"
        ]
        self.categorical_cols: list[str] = [
            c.name for c in self._profile.columns if c.dtype_category == "categorical"
        ]
        self.date_cols: list[str] = [
            c.name for c in self._profile.columns if c.dtype_category == "datetime" or c.inferred_role == "temporal"
        ]
        self.geo_cols: list[str] = [
            c.name for c in self._profile.columns if c.inferred_role == "geo"
        ]
        self.categorical_unique_values: dict[str, list[str]] = {
            c.name: [v["value"] for v in (c.top_values or [])]
            for c in self._profile.columns
            if c.top_values
        }

    # ------------------------------------------------------------------
    # KPIs
    # ------------------------------------------------------------------

    def get_kpis(self) -> dict[str, Any]:
        if not self.metric_col:
            return {"error": "No numeric metric column found in dataset profile"}

        total_value = float(self.df[self.metric_col].sum())
        mean_value  = float(self.df[self.metric_col].mean() or 0)
        std_dev     = float(self.df[self.metric_col].std() or 0)

        growth_rate = 0.0
        if self.df.height > 1:
            half = self.df.height // 2
            first_half  = float(self.df.head(half)[self.metric_col].sum() or 0)
            second_half = float(self.df.tail(self.df.height - half)[self.metric_col].sum() or 0)
            if first_half > 0:
                growth_rate = ((second_half - first_half) / first_half) * 100

        unique_segments = self.df[self.category_col].n_unique() if self.category_col else 0
        unique_regions  = self.df[self.geo_col].n_unique() if self.geo_col else 0

        null_pct = self.df.null_count().sum().row(0)[0] / (self.df.height * len(self.headers) or 1)
        quality_score = max(50, int(100 - (null_pct * 100)))

        return {
            "metric_name": self.metric_col,
            "total_value": total_value,
            "mean_value": mean_value,
            "std_dev": std_dev,
            "growth_rate": growth_rate,
            "total_records": self.df.height,
            "unique_categories": unique_segments,
            "unique_regions": unique_regions,
            "quality_score": quality_score,
        }

    # ------------------------------------------------------------------
    # Trends
    # ------------------------------------------------------------------

    def get_trends(self) -> dict[str, Any]:
        if not self.metric_col:
            return {"error": "No numeric metric column found in dataset profile"}

        df_sorted = self.df
        if self.date_col:
            if self.df.schema[self.date_col] == pl.Utf8:
                df_sorted = self.df.with_columns(
                    pl.col(self.date_col).str.to_datetime(strict=False).alias("_parsed_date")
                )
            else:
                df_sorted = self.df.with_columns(
                    pl.col(self.date_col).alias("_parsed_date")
                )
            df_sorted = df_sorted.sort("_parsed_date")
            grouped = (
                df_sorted
                .group_by("_parsed_date")
                .agg(pl.col(self.metric_col).sum().alias("value"))
                .sort("_parsed_date")
            )
            dates  = [str(d) for d in grouped["_parsed_date"].to_list()]
            values = grouped["value"].to_list()
        else:
            dates  = [f"Period {i + 1}" for i in range(self.df.height)]
            values = self.df[self.metric_col].to_list()

        values_np = np.array(values, dtype=float)
        window = max(2, len(values_np) // 5)
        sma = np.convolve(values_np, np.ones(window) / window, mode="same").tolist()

        return {"metric": self.metric_col, "dates": dates, "values": values, "moving_average": sma}

    # ------------------------------------------------------------------
    # Geo metrics
    # ------------------------------------------------------------------

    def get_geo_metrics(self) -> list[dict[str, Any]]:
        active_geo = self.geo_col or self.category_col
        if not active_geo or not self.metric_col:
            return []

        grouped = (
            self.df
            .group_by(active_geo)
            .agg([pl.col(self.metric_col).sum().alias("value"), pl.len().alias("count")])
            .sort("value", descending=True)
        )

        return [
            {"region": row[0], "value": float(row[1] or 0), "count": int(row[2] or 0)}
            for row in grouped.iter_rows()
        ]

    # ------------------------------------------------------------------
    # Anomalies
    # ------------------------------------------------------------------

    def get_anomalies(self) -> list[dict[str, Any]]:
        if not self.metric_col:
            return []

        vals = self.df[self.metric_col].to_numpy().astype(float)
        if len(vals) < 3:
            return []

        mean = np.mean(vals)
        std  = np.std(vals) or 1.0
        q75, q25 = np.percentile(vals, [75, 25])
        iqr = q75 - q25
        lower_bound = q25 - 1.5 * iqr
        upper_bound = q75 + 1.5 * iqr

        anomalies: list[dict[str, Any]] = []
        for i, val in enumerate(vals):
            z_score  = (val - mean) / std
            is_out   = abs(z_score) > 2.0 or val < lower_bound or val > upper_bound
            if not is_out:
                continue

            severity = "Low"
            if abs(z_score) >= 3.0:
                severity = "Critical"
            elif abs(z_score) >= 2.4:
                severity = "High"
            elif abs(z_score) >= 1.8:
                severity = "Medium"

            date_str     = str(self.df.row(i)[self.headers.index(self.date_col)]) if self.date_col else f"Row {i + 1}"
            category_str = str(self.df.row(i)[self.headers.index(self.category_col)]) if self.category_col else "General"
            region_str   = str(self.df.row(i)[self.headers.index(self.geo_col)]) if self.geo_col else "Global"

            anomalies.append({
                "row_index": i + 1,
                "date": date_str,
                "category": category_str,
                "region": region_str,
                "value": float(val),
                "z_score": float(z_score),
                "deviation_pct": float(((val - mean) / (mean or 1.0)) * 100),
                "severity": severity,
            })
        return anomalies

    # ------------------------------------------------------------------
    # Correlations (from stored profile matrix if available)
    # ------------------------------------------------------------------

    def get_correlations(self) -> dict[str, Any]:
        if self._profile.correlation_matrix:
            cm = self._profile.correlation_matrix
            return {"columns": cm.columns, "matrix": cm.matrix}

        # Fallback: compute on the fly
        all_numeric = [c for c in self.numeric_cols if c in self.headers]
        if len(all_numeric) < 2:
            return {"columns": all_numeric, "matrix": [[1.0]]}

        sub_df = self.df.select(all_numeric).drop_nulls()
        if sub_df.height < 3:
            return {"columns": all_numeric, "matrix": [[1.0] * len(all_numeric)] * len(all_numeric)}

        matrix: list[list[float]] = []
        for col_a in all_numeric:
            row_corrs: list[float] = []
            for col_b in all_numeric:
                corr = float(np.corrcoef(sub_df[col_a].to_numpy(), sub_df[col_b].to_numpy())[0, 1])
                row_corrs.append(0.0 if np.isnan(corr) else corr)
            matrix.append(row_corrs)

        return {"columns": all_numeric, "matrix": matrix}

    # ------------------------------------------------------------------
    # Statistical context summary (for Gemini prompt)
    # ------------------------------------------------------------------

    def generate_statistical_context_summary(self) -> str:
        kpis = self.get_kpis()
        geo  = self.get_geo_metrics()
        anomalies = self.get_anomalies()

        summary: list[str] = [
            f"Dataset summary of file: {os.path.basename(self.file_path)}",
            f"Primary target metric: {self.metric_col}",
            f"Total rows: {self.num_rows}",
            f"Total aggregate value: {kpis.get('total_value', 0):,.2f}",
            f"Mean value: {kpis.get('mean_value', 0):,.2f}",
            f"Growth Rate (Period-over-Period): {kpis.get('growth_rate', 0):.1f}%",
        ]

        if self.category_col:
            cats = self.categorical_unique_values.get(self.category_col, [])
            summary.append(f"Grouping categories in '{self.category_col}': [{', '.join(cats[:10])}]")
        if self.geo_col:
            geos = self.categorical_unique_values.get(self.geo_col, [])
            summary.append(f"Geography categories in '{self.geo_col}': [{', '.join(geos[:10])}]")

        if geo:
            top = geo[0]
            summary.append(
                f"Top performing region/segment: '{top.get('region')}' "
                f"with value {top.get('value', 0):,.2f} ({top.get('count')} records)"
            )

        summary.append(f"Statistical anomalies/outliers detected: {len(anomalies)}")
        for idx, anom in enumerate(anomalies[:5]):
            summary.append(
                f" - Outlier {idx + 1}: Row {anom['row_index']} at Date {anom['date']}, "
                f"Category {anom['category']}, Region {anom['region']} "
                f"with value {anom['value']:,.2f} (Z-Score: {anom['z_score']:.2f})"
            )

        return "\n".join(summary)

    def get_signals(self) -> list[dict[str, Any]]:
        """
        Runs deterministic SignalDetector to extract statistical insights
        (outliers, drift, correlation pairs, missingness clusters, imbalance).
        """
        try:
            from .signals import SignalDetector
            signals = SignalDetector.detect_signals(self.df, self._profile)
            return [s.model_dump() for s in signals]
        except Exception as e:
            logger.error(f"Failed to detect signals for dataset: {e}")
            return []

    # ------------------------------------------------------------------
    # Utility
    # ------------------------------------------------------------------

    @staticmethod
    def get_dataset_df(file_path: str) -> Optional[pl.DataFrame]:
        try:
            return _load_df(file_path)
        except Exception:
            return None
