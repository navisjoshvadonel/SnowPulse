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
from typing import Any

import numpy as np
import polars as pl

from ..analytics.profiler import DatasetProfile, DatasetProfiler
from ..storage.service import storage_service
from .semantic_layer import DimensionDef, MetricDef, SemanticModel, semantic_layer

logger = logging.getLogger("snowpulse.analytics.engine")


def _load_df(file_path: str | pl.DataFrame) -> pl.DataFrame:
    """Read a polars DataFrame from MinIO, local disk, or direct DataFrame object."""
    if isinstance(file_path, pl.DataFrame):
        return file_path
    if hasattr(file_path, "to_numpy"): # pandas DataFrame
        return pl.from_pandas(file_path)

    if isinstance(file_path, str):
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
    raise TypeError(f"Unsupported file_path type: {type(file_path)}")


class AnalyticsEngine:
    """
    Computes KPIs, trends, geo distributions, anomalies, and correlations
    for a single dataset. Column roles are read from a DatasetProfile;
    this class never performs its own column-name heuristics.
    """

    def __init__(self, file_path: str | pl.DataFrame, profile: DatasetProfile | None = None):
        self.file_path = file_path if isinstance(file_path, str) else "dataframe"
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
        metric_cand = next((c.name for c in self._profile.columns if c.is_primary_metric and c.dtype_category == "numeric"), None)
        if not metric_cand:
            metric_cand = next((c.name for c in self._profile.columns if c.is_primary_metric), None)
        if not metric_cand:
            metric_cand = next((c.name for c in self._profile.columns if c.dtype_category == "numeric"), None)
        self.metric_col: str | None = metric_cand
        self.date_col: str | None = next(
            (c.name for c in self._profile.columns if c.is_primary_date), None
        )
        self.category_col: str | None = next(
            (c.name for c in self._profile.columns if c.is_primary_category), None
        )
        self.geo_col: str | None = next(
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

        # Automatically construct and register a Semantic Model
        str_path = file_path if isinstance(file_path, str) else "dataframe"
        self.semantic_model_name = f"model_{os.path.basename(str_path).split('.')[0]}"
        dimensions = []
        metrics = []

        for c in self._profile.columns:
            clean_name = c.name.replace(" ", "_").lower()
            if c.dtype_category in ("categorical", "datetime") or c.inferred_role in ("geo", "temporal", "category"):
                dimensions.append(DimensionDef(
                    name=clean_name,
                    description=f"{c.semantic_type or c.inferred_role or 'general'} dimension",
                    column=c.name
                ))
            elif c.dtype_category == "numeric":
                metrics.append(MetricDef(
                    name=f"total_{clean_name}",
                    description=f"Total sum of {c.name}",
                    column=c.name,
                    agg="sum"
                ))
                metrics.append(MetricDef(
                    name=f"average_{clean_name}",
                    description=f"Average of {c.name}",
                    column=c.name,
                    agg="avg"
                ))

        sm = SemanticModel(
            name=self.semantic_model_name,
            description=f"Auto-generated semantic model for {os.path.basename(str_path)}",
            dimensions=dimensions,
            metrics=metrics
        )
        semantic_layer.register_model(sm)

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

        if len(values_np) >= 5:
            # ------------------------------------------------------------------
            # DYNAMIC LEARNING: Trend Forecasting (No hardcoded moving averages)
            # ------------------------------------------------------------------
            import pandas as pd
            from sklearn.linear_model import Ridge

            X = np.arange(len(values_np)).reshape(-1, 1)
            model = Ridge(alpha=1.0)
            model.fit(X, values_np)

            # Predict historical trend line
            trend_line = model.predict(X).tolist()

            # Dynamically forecast next 3 periods
            X_future = np.arange(len(values_np), len(values_np) + 3).reshape(-1, 1)
            forecast_preds = model.predict(X_future).tolist()

            future_dates = []
            if self.date_col:
                try:
                    last_date = pd.to_datetime(dates[-1])
                    diff = pd.to_datetime(dates[-1]) - pd.to_datetime(dates[-2])
                    for i in range(1, 4):
                        future_dates.append(str((last_date + (diff * i)).date()))
                except Exception:
                    future_dates = [f"Forecast {i}" for i in range(1, 4)]
            else:
                future_dates = [f"Period {len(values_np) + i}" for i in range(1, 4)]

            return {
                "metric": self.metric_col,
                "dates": dates,
                "values": values,
                "moving_average": trend_line, # Keep key for frontend compat
                "forecast_dates": future_dates,
                "forecast_values": forecast_preds
            }
        else:
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
        if len(vals) < 10:
            return []

        # ------------------------------------------------------------------
        # DYNAMIC LEARNING: Isolation Forest (No hardcoded Z-Score thresholds)
        # ------------------------------------------------------------------
        from sklearn.ensemble import IsolationForest

        # We learn the data distribution dynamically. "auto" contamination means
        # the model decides the threshold based on the tree depth distributions.
        X = vals.reshape(-1, 1)
        iso_forest = IsolationForest(contamination="auto", random_state=42)
        preds = iso_forest.fit_predict(X)
        anomaly_scores = iso_forest.decision_function(X) # lower is more anomalous

        # Robust Z-Score (Median Absolute Deviation) calculation for heavy-tailed skew resilience
        med_val = float(np.median(vals))
        mad = float(np.median(np.abs(vals - med_val)))
        mad_denom = mad if mad > 1e-9 else 1.0
        robust_z_scores = 0.6745 * (vals - med_val) / mad_denom

        mean_val = np.mean(vals)
        score_percentile_5 = np.percentile(anomaly_scores, 5)

        # Precompute means and stds of all other numeric columns for causal analysis
        other_numeric_cols = [
            c for c in self.numeric_cols
            if c != self.metric_col and c in self.headers and (self.df[c].std() or 0) > 1e-12
        ]
        col_means = {col: self.df[col].mean() for col in other_numeric_cols}
        col_stds = {col: self.df[col].std() for col in other_numeric_cols}

        anomalies: list[dict[str, Any]] = []
        for i, (pred, score, val, rz) in enumerate(zip(preds, anomaly_scores, vals, robust_z_scores, strict=False)):
            if pred == -1 or abs(rz) >= 3.0: # Anomaly detected by Isolation Forest or MAD Robust Z-Score
                severity = "Critical" if (score <= score_percentile_5 or abs(rz) >= 4.0) else "High"

                row_dict = self.df.row(i, named=True)
                date_str     = str(row_dict.get(self.date_col, f"Row {i + 1}"))
                category_str = str(row_dict.get(self.category_col, "General"))
                region_str   = str(row_dict.get(self.geo_col, "Global"))

                # ------------------------------------------------------------------
                # DYNAMIC LEARNING: Causal Inference (Root Cause Analysis)
                # We identify which secondary metric deviated the most concurrently
                # ------------------------------------------------------------------
                root_cause = "No clear secondary driver detected."
                max_deviation_z = 0.0
                primary_driver = None

                for col in other_numeric_cols:
                    if col_stds[col] and col_stds[col] > 0:
                        cell_val = row_dict.get(col, col_means[col])
                        if cell_val is not None:
                            z_dev = abs(float(cell_val) - float(col_means[col])) / float(col_stds[col])
                            if z_dev > max_deviation_z and z_dev > 1.5: # At least 1.5 sigma deviation
                                max_deviation_z = z_dev
                                primary_driver = col

                if primary_driver:
                    driver_val = float(row_dict[primary_driver])
                    driver_mean = float(col_means[primary_driver])
                    direction = "spiked" if driver_val > driver_mean else "dropped"
                    root_cause = f"Likely driven by {primary_driver}, which {direction} to {driver_val:.1f} (avg: {driver_mean:.1f})."

                anomalies.append({
                    "row_index": i + 1,
                    "date": date_str,
                    "category": category_str,
                    "region": region_str,
                    "value": float(val),
                    "z_score": float(round(rz, 2)),
                    "deviation_pct": float(((val - mean_val) / (mean_val or 1.0)) * 100),
                    "severity": severity,
                    "root_cause": root_cause
                })

        # Sort anomalies by severity (highest absolute robust Z-score first)
        anomalies.sort(key=lambda x: abs(x["z_score"]), reverse=True)
        return anomalies

    # ------------------------------------------------------------------
    # Correlations (from stored profile matrix if available)
    # ------------------------------------------------------------------

    def get_correlations(self) -> dict[str, Any]:
        if self._profile.correlation_matrix:
            cm = self._profile.correlation_matrix
            valid_indices = [
                i for i, col in enumerate(cm.columns)
                if any(v is not None for j, v in enumerate(cm.matrix[i]) if i != j)
            ]
            if len(valid_indices) >= 2:
                filtered_cols = [cm.columns[i] for i in valid_indices]
                filtered_matrix = [
                    [cm.matrix[i][j] for j in valid_indices]
                    for i in valid_indices
                ]
                return {"columns": filtered_cols, "matrix": filtered_matrix}
            return {"columns": cm.columns, "matrix": cm.matrix}

        # Fallback: compute on the fly, masking out zero-variance columns
        all_numeric = [c for c in self.numeric_cols if c in self.headers and (self.df[c].std() or 0) > 1e-12]
        if len(all_numeric) < 2:
            return {"columns": all_numeric, "matrix": [[1.0]]}

        sub_df = self.df.select(all_numeric).drop_nulls()
        if sub_df.height < 3:
            return {"columns": all_numeric, "matrix": [[1.0] * len(all_numeric)] * len(all_numeric)}

        matrix: list[list[float]] = []
        for col_a in all_numeric:
            row_corrs: list[float] = []
            std_a = sub_df[col_a].std() or 0
            for col_b in all_numeric:
                std_b = sub_df[col_b].std() or 0
                if std_a <= 1e-12 or std_b <= 1e-12:
                    row_corrs.append(0.0)
                else:
                    corr = float(np.corrcoef(sub_df[col_a].to_numpy(), sub_df[col_b].to_numpy())[0, 1])
                    row_corrs.append(0.0 if np.isnan(corr) else round(corr, 4))
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

        # Append Semantic Context Layer to force LLM compliance
        semantic_ctx = semantic_layer.get_context_for_llm(self.semantic_model_name)
        summary.append(f"\n{semantic_ctx}\n")

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
    # Autonomous Root-Cause Decomposition Tree
    # ------------------------------------------------------------------

    def get_decomposition_tree(
        self,
        target_metric: str | None = None,
        dimensions: list[str] | None = None,
        max_depth: int = 3
    ) -> dict[str, Any]:
        """
        SHAP / Variance-based Autonomous Root-Cause Decomposition Tree.
        Decomposes top-line target metric into nested dimension branches,
        calculating percentage contribution, variance delta, and identifying
        the primary bottleneck drop path.
        """
        metric = target_metric or self.metric_col
        if not metric or metric not in self.df.columns:
            return {"error": f"Target metric '{metric}' not found in dataset"}

        # Select candidate dimensions
        dim_candidates = dimensions or []
        if not dim_candidates:
            if self.category_col:
                dim_candidates.append(self.category_col)
            if self.geo_col and self.geo_col != self.category_col:
                dim_candidates.append(self.geo_col)
            for col in self.categorical_cols:
                if col not in dim_candidates:
                    dim_candidates.append(col)

        # Filter valid columns
        valid_dims = [d for d in dim_candidates if d in self.df.columns and d != metric][:max_depth]
        if not valid_dims:
            return {"error": "No valid categorical dimensions available for decomposition"}

        total_value = float(self.df[metric].sum() or 0)
        total_rows = self.df.height

        root_node = {
            "name": f"Total {metric} ({total_value:,.0f})",
            "dimension": "Root",
            "value": "Total",
            "metric_name": metric,
            "metric_value": total_value,
            "impact_pct": 100.0,
            "delta_value": 0.0,
            "direction": "neutral",
            "node_type": "root",
            "record_count": total_rows,
            "children": []
        }

        def build_branch(sub_df: pl.DataFrame, current_dim_idx: int, parent_val: float) -> list[dict[str, Any]]:
            if current_dim_idx >= len(valid_dims) or sub_df.height == 0:
                return []

            dim = valid_dims[current_dim_idx]
            grouped = (
                sub_df
                .group_by(dim)
                .agg([
                    pl.col(metric).sum().alias("sum_val"),
                    pl.col(metric).mean().alias("mean_val"),
                    pl.len().alias("count")
                ])
                .sort("sum_val", descending=True)
            )

            results = []
            group_rows = grouped.to_dicts()
            if not group_rows:
                return []

            # Calculate baseline mean per category for variance contribution
            expected_share = parent_val / max(1, len(group_rows))

            for row in group_rows:
                cat_val = str(row[dim] if row[dim] is not None else "Unknown")
                sum_v = float(row["sum_val"] or 0)
                mean_v = float(row["mean_val"] or 0)
                count_v = int(row["count"] or 0)

                impact_pct = (sum_v / parent_val * 100.0) if parent_val > 0 else 0.0
                delta = sum_v - expected_share
                direction = "positive" if delta >= 0 else "negative"

                child_sub = sub_df.filter(pl.col(dim) == row[dim])
                next_children = build_branch(child_sub, current_dim_idx + 1, sum_v)

                node = {
                    "name": f"{cat_val} ({sum_v:,.0f})",
                    "dimension": dim,
                    "value": cat_val,
                    "metric_value": round(sum_v, 2),
                    "mean_value": round(mean_v, 2),
                    "impact_pct": round(impact_pct, 1),
                    "delta_value": round(delta, 2),
                    "direction": direction,
                    "record_count": count_v,
                    "node_type": "branch",
                    "children": next_children
                }
                results.append(node)

            # Highlight bottleneck (worst negative delta) & top driver (highest positive delta)
            if results:
                min_node = min(results, key=lambda x: x["delta_value"])
                max_node = max(results, key=lambda x: x["delta_value"])
                if min_node["delta_value"] < 0:
                    min_node["is_bottleneck"] = True
                    min_node["bottleneck_reason"] = f"Primary Drop Factor: {min_node['delta_value']:,.0f} below expected mean"
                if max_node["delta_value"] > 0:
                    max_node["is_top_driver"] = True

            return results

        root_node["children"] = build_branch(self.df, 0, total_value)

        # Highlight primary root cause path throughout the tree
        primary_bottleneck_path = []
        curr = root_node
        while curr and curr.get("children"):
            b_child = next((c for c in curr["children"] if c.get("is_bottleneck")), None)
            if not b_child and curr["children"]:
                b_child = min(curr["children"], key=lambda x: x.get("delta_value", 0))
            if b_child:
                b_child["is_primary_root_cause_path"] = True
                primary_bottleneck_path.append(f"{b_child['dimension']}: {b_child['value']}")
                curr = b_child
            else:
                break

        return {
            "root": root_node,
            "target_metric": metric,
            "decomposed_dimensions": valid_dims,
            "total_value": total_value,
            "primary_root_cause_path": primary_bottleneck_path,
            "summary_insight": f"Decomposition of '{metric}' across [{', '.join(valid_dims)}] identified key bottleneck path: {' ➔ '.join(primary_bottleneck_path) if primary_bottleneck_path else 'Balanced performance across dimensions'}."
        }

    # ------------------------------------------------------------------
    # AI Monte Carlo Risk & Scenario Simulator Engine
    # ------------------------------------------------------------------

    def get_monte_carlo_simulation(
        self,
        target_metric: str | None = None,
        steps: int = 12,
        iterations: int = 1000,
        price_delta: float = 0.0,
        cost_delta: float = 0.0,
        churn_delta: float = 0.0,
        volatility: float = 0.15,
        target_threshold: float | None = None
    ) -> dict[str, Any]:
        """
        Executes a 1,000-run (or N-run) stochastic Monte Carlo simulation using Geometric Brownian Motion
        to project confidence bands (P10, P25, P50, P75, P90) and tail-risk metrics (95% VaR, CVaR).
        """
        import numpy as np

        # Fallback to primary numeric column if target_metric is omitted
        metric = target_metric
        if not metric or metric not in self.df.columns:
            num_cols = [c for c, dt in self.df.schema.items() if dt.is_numeric()]
            if not num_cols:
                return {"error": "No numeric metric found for Monte Carlo simulation"}
            metric = num_cols[0]

        series = self.df[metric].drop_nulls()
        if len(series) == 0:
            return {"error": f"Metric '{metric}' contains no valid numeric records"}

        vals = series.to_numpy()
        base_val = float(np.median(vals)) if len(vals) > 0 else 100.0
        if base_val <= 0:
            base_val = max(1.0, float(np.mean(np.abs(vals))))

        # Historical growth rate & drift estimation
        hist_std = float(np.std(vals) / (np.mean(vals) + 1e-9)) if len(vals) > 1 else 0.1
        vol = max(0.01, min(1.0, float(volatility) if volatility > 0 else hist_std))

        # Effective annual/monthly drift considering what-if parameters
        # Price increases boost outcome (+), cost inflation reduces outcome (-), churn reduces outcome (-)
        net_param_impact = price_delta - cost_delta - churn_delta
        mu_base = 0.05  # 5% annual baseline drift
        mu_eff = mu_base + net_param_impact

        # Time steps (e.g. months)
        steps = max(3, min(60, steps))
        iterations = max(100, min(10000, iterations))
        dt = 1.0 / 12.0  # Monthly steps

        # Generate stochastic trajectories via Geometric Brownian Motion (GBM)
        # S_{t+1} = S_t * exp((mu - 0.5 * sigma^2)*dt + sigma * sqrt(dt) * Z_t)
        np.random.seed(42)  # Deterministic seed for reproducible analytical runs
        shocks = np.random.normal(0, 1, size=(iterations, steps))
        drift = (mu_eff - 0.5 * (vol ** 2)) * dt
        diffusion = vol * np.sqrt(dt) * shocks

        multipliers = np.exp(drift + diffusion)

        paths = np.zeros((iterations, steps + 1))
        paths[:, 0] = base_val

        for t in range(1, steps + 1):
            paths[:, t] = paths[:, t - 1] * multipliers[:, t - 1]

        # Calculate percentiles across all iterations at each time step
        p10 = np.percentile(paths, 10, axis=0)
        p25 = np.percentile(paths, 25, axis=0)
        p50 = np.percentile(paths, 50, axis=0)
        p75 = np.percentile(paths, 75, axis=0)
        p90 = np.percentile(paths, 90, axis=0)

        step_labels = [f"M{t}" if t > 0 else "Base" for t in range(steps + 1)]

        # Final step outcome statistics
        final_vals = paths[:, -1]
        final_p50 = float(p50[-1])
        final_p10 = float(p10[-1])
        final_p90 = float(p90[-1])

        # Risk Metrics (Value-at-Risk VaR & Conditional VaR CVaR)
        p5_val = float(np.percentile(final_vals, 5))
        var_95 = max(0.0, base_val - p5_val)
        worst_5_pct = final_vals[final_vals <= p5_val]
        cvar_95 = max(var_95, base_val - float(np.mean(worst_5_pct))) if len(worst_5_pct) > 0 else var_95

        loss_count = np.sum(final_vals < base_val)
        prob_of_loss = round(float(loss_count / iterations * 100.0), 1)

        threshold = target_threshold if target_threshold is not None else base_val * 1.15
        target_count = np.sum(final_vals >= threshold)
        prob_of_target = round(float(target_count / iterations * 100.0), 1)

        # Final Outcome Frequency Histogram (15 Bins)
        counts, bin_edges = np.histogram(final_vals, bins=12)
        distribution_bins = []
        for i in range(len(counts)):
            b_min = float(bin_edges[i])
            b_max = float(bin_edges[i + 1])
            b_count = int(counts[i])
            pct = round((b_count / iterations) * 100.0, 1)

            tier = "Expected"
            if b_max <= final_p10:
                tier = "Worst Case (P10)"
            elif b_min >= final_p90:
                tier = "Optimistic (P90)"

            distribution_bins.append({
                "bin_min": round(b_min, 2),
                "bin_max": round(b_max, 2),
                "label": f"{b_min:,.0f} - {b_max:,.0f}",
                "count": b_count,
                "percentage": pct,
                "tier": tier
            })

        # Synthesis Narrative
        impact_dir = "favorable" if net_param_impact >= 0 else "adverse"
        ai_narrative = (
            f"Executed {iterations:,} stochastic Monte Carlo trajectories for '{metric}'. "
            f"Under net {impact_dir} parameter shifts (Pricing: {price_delta*100:+.1f}%, Cost: {cost_delta*100:+.1f}%, Churn: {churn_delta*100:+.1f}%, Volatility: {vol*100:.1f}%), "
            f"the P50 expected outcome is {final_p50:,.2f} (+{((final_p50/base_val)-1)*100:.1f}% vs baseline {base_val:,.2f}). "
            f"Tail-risk analysis indicates a {prob_of_loss}% downside risk of loss, with a 95% Value-at-Risk (VaR) of {var_95:,.2f}."
        )

        return {
            "target_metric": metric,
            "base_value": round(base_val, 2),
            "iterations": iterations,
            "steps": steps,
            "parameters": {
                "price_delta": price_delta,
                "cost_delta": cost_delta,
                "churn_delta": churn_delta,
                "volatility": vol,
                "net_impact_pct": round(net_param_impact * 100, 1),
            },
            "step_labels": step_labels,
            "percentiles": {
                "p10": [round(x, 2) for x in p10.tolist()],
                "p25": [round(x, 2) for x in p25.tolist()],
                "p50": [round(x, 2) for x in p50.tolist()],
                "p75": [round(x, 2) for x in p75.tolist()],
                "p90": [round(x, 2) for x in p90.tolist()],
            },
            "risk_metrics": {
                "final_p10": round(final_p10, 2),
                "final_p50": round(final_p50, 2),
                "final_p90": round(final_p90, 2),
                "var_95": round(var_95, 2),
                "cvar_95": round(cvar_95, 2),
                "prob_of_loss": prob_of_loss,
                "prob_of_target": prob_of_target,
                "target_threshold": round(threshold, 2),
            },
            "distribution_bins": distribution_bins,
            "ai_risk_narrative": ai_narrative,
        }

    # ------------------------------------------------------------------
    # Utility
    # ------------------------------------------------------------------

    @staticmethod
    def get_dataset_df(file_path: str) -> pl.DataFrame | None:
        try:
            return _load_df(file_path)
        except Exception:
            return None
