"""
SnowPulse AI - Native High-Performance Analytics Profiler & Intelligence Engine.
Vectorized exploratory data analysis (EDA), anomaly discovery, and autonomous insights.
"""

from typing import Any

import numpy as np
import polars as pl

from ..analytics.profiler import DatasetProfiler
from ..analytics.signals import SignalDetector


class NativeDataAnalyzer:
    def __init__(self, df: pl.DataFrame, name: str = "Dataset"):
        self.df = df
        self.name = name
        self.profile = DatasetProfiler.profile_full(df)
        self.numeric_cols = [c.name for c in self.profile.columns if c.dtype_category == "numeric"]
        self.categorical_cols = [c.name for c in self.profile.columns if c.dtype_category == "categorical"]
        self.date_cols = [c.name for c in self.profile.columns if c.dtype_category == "datetime"]

    def get_summary(self) -> dict[str, Any]:
        """
        Returns high-level structural metrics and overall data quality health score.
        """
        if self.profile.quality_report:
            total_missing = self.profile.quality_report.total_null_cells
            dup_count = self.profile.quality_report.duplicate_rows_count
            quality_score = round(self.profile.quality_report.health_score, 1)
        else:
            total_cells = self.df.height * self.df.width if self.df.width > 0 else 1
            total_missing = sum(int((c.null_percentage / 100.0) * self.df.height) for c in self.profile.columns)
            completeness = max(0.0, 1.0 - (total_missing / max(total_cells, 1)))
            dup_count = self.df.height - self.df.unique().height if self.df.height > 0 else 0
            uniqueness = max(0.0, 1.0 - (dup_count / max(self.df.height, 1)))
            quality_score = round((completeness * 0.6 + uniqueness * 0.4) * 100, 1)

        return {
            "name": self.name,
            "rows": self.df.height,
            "columns": self.df.width,
            "numeric_count": len(self.numeric_cols),
            "categorical_count": len(self.categorical_cols),
            "temporal_count": len(self.date_cols),
            "memory_mb": round(self.df.estimated_size() / (1024 * 1024), 2),
            "quality_score": quality_score,
            "total_missing": total_missing,
            "duplicate_rows": dup_count,
        }

    def get_column_stats(self) -> list[dict[str, Any]]:
        """
        Returns column-by-column statistical profiles.
        """
        stats = []
        for col in self.profile.columns:
            c_dict: dict[str, Any] = {
                "name": col.name,
                "role": col.inferred_role,
                "dtype": col.dtype_category,
                "missing_pct": round(col.null_percentage, 1),
                "cardinality": col.cardinality,
            }
            if col.dtype_category == "numeric" and col.name in self.df.columns:
                series = self.df[col.name].drop_nulls()
                if len(series) > 0:
                    c_dict.update({
                        "mean": round(float(series.mean() or 0.0), 2),
                        "std": round(float(series.std() or 0.0), 2),
                        "min": round(float(series.min() or 0.0), 2),
                        "median": round(float(series.median() or 0.0), 2),
                        "max": round(float(series.max() or 0.0), 2),
                    })
            elif col.dtype_category == "categorical" and col.name in self.df.columns:
                series = self.df[col.name].drop_nulls()
                if len(series) > 0:
                    top_counts = series.value_counts().sort("count", descending=True).head(3)
                    top_vals = [f"{row[0]} ({row[1]})" for row in top_counts.iter_rows()]
                    c_dict["top_values"] = ", ".join(top_vals)

            stats.append(c_dict)
        return stats

    def get_top_correlations(self, min_corr: float = 0.5, top_n: int = 10) -> list[dict[str, Any]]:
        """
        Computes fast vectorized Pearson correlations and returns top pairs.
        """
        if len(self.numeric_cols) < 2:
            return []

        work_cols = self.numeric_cols[:30]  # Cap to top 30 numeric columns for instant computation
        sub_df = self.df.select(work_cols).fill_null(strategy="mean")
        matrix = sub_df.to_numpy()

        try:
            corr_mat = np.corrcoef(matrix, rowvar=False)
            results = []
            for i in range(len(work_cols)):
                for j in range(i + 1, len(work_cols)):
                    r = float(corr_mat[i, j])
                    if not np.isnan(r) and abs(r) >= min_corr:
                        results.append({
                            "col_a": work_cols[i],
                            "col_b": work_cols[j],
                            "r": round(r, 3),
                            "abs_r": abs(r),
                            "relationship": "Strong Positive" if r > 0.7 else ("Moderate Positive" if r > 0 else ("Strong Negative" if r < -0.7 else "Moderate Negative")),
                        })
            results.sort(key=lambda x: x["abs_r"], reverse=True)
            return results[:top_n]
        except Exception:
            return []

    def get_signals(self) -> list[dict[str, Any]]:
        """
        Detects statistical anomalies, data drift, outliers, and category imbalances.
        """
        detected = SignalDetector.detect_signals(self.df, self.profile, min_signals=3, max_signals=8)
        return [
            {
                "id": s.id,
                "type": s.signal_type,
                "title": s.title,
                "description": s.description,
                "severity": s.severity_score,
                "significance": s.statistical_significance,
                "columns": s.columns,
            }
            for s in detected
        ]

    def generate_narrative(self) -> list[str]:
        """
        Synthesizes an executive narrative from metrics and signals.
        """
        summary = self.get_summary()
        narrative = [
            f"**Dataset Architecture**: '{self.name}' contains {summary['rows']:,} rows and {summary['columns']} attributes, consuming {summary['memory_mb']} MB in RAM.",
            f"**Data Quality & Cleanliness**: Scored **{summary['quality_score']}%** overall health with {summary['total_missing']:,} null values and {summary['duplicate_rows']:,} duplicate rows.",
        ]

        # Top correlation insight
        corrs = self.get_top_correlations(top_n=3)
        if corrs:
            top_corr = corrs[0]
            narrative.append(
                f"**Key Driver Discovery**: Found a **{top_corr['relationship']}** correlation (r = {top_corr['r']}) between `{top_corr['col_a']}` and `{top_corr['col_b']}`."
            )

        # Signal insight
        signals = self.get_signals()
        if signals:
            top_sig = signals[0]
            narrative.append(f"**Anomaly Alert**: {top_sig['title']} - {top_sig['description']}")

        return narrative
