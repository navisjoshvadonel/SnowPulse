"""
signals.py — Deterministic Signal Detection Engine for SnowPulse.

Detects statistical insights deterministically from dataset profiles and raw DataFrames
without requiring any LLM calls.

Signals Detected:
1. Outlier Detection (IQR + Isolation Forest for skewed columns)
2. Distribution Shift / Drift (Time bucket z-score analysis)
3. High-Correlation & Inverse Relationship Pairs (|r| >= 0.8)
4. Missing-Data Clusters (Co-occurrence null mask analysis)
5. Category Imbalance (Top category share > 80% + Gini index)
"""

from __future__ import annotations

import logging
from typing import Any

import numpy as np
import polars as pl
from pydantic import BaseModel, Field
from sklearn.ensemble import IsolationForest

from .profiler import ColumnProfile, DatasetProfile

logger = logging.getLogger("snowpulse.analytics.signals")


class DetectedSignal(BaseModel):
    id: str
    signal_type: str  # "outlier", "multivariate_outlier", "distribution_shift", "high_correlation", "inverse_relationship", "missingness_cluster", "category_imbalance"
    title: str
    description: str
    columns: list[str]
    severity_score: float = Field(ge=0.0, le=1.0)
    statistical_significance: float = Field(ge=0.0, le=1.0)
    business_relevance: float = Field(ge=0.0, le=1.0)
    details: dict[str, Any] = {}


class SignalDetector:
    """
    Deterministic signal detection engine.
    Calculates outliers, drift, correlation pairs, missing clusters, and category imbalance.
    Ranks signals using severity_score = statistical_significance * business_relevance_proxy.
    """

    @classmethod
    def detect_signals(
        cls,
        df: pl.DataFrame,
        profile: DatasetProfile,
        min_signals: int = 5,
        max_signals: int = 8
    ) -> list[DetectedSignal]:
        signals: list[DetectedSignal] = []

        # 1. Outlier Detection
        signals.extend(cls._detect_outliers(df, profile))

        # 2. Distribution Shift / Drift
        signals.extend(cls._detect_distribution_shifts(df, profile))

        # 3. High Correlation & Inverse Relationships
        signals.extend(cls._detect_correlation_signals(profile))

        # 4. Missing Data Clusters (Co-occurrence)
        signals.extend(cls._detect_missingness_clusters(df, profile))

        # 5. Category Imbalance
        signals.extend(cls._detect_category_imbalance(df, profile))

        # Deduplicate near-identical signals
        deduped = cls._deduplicate_signals(signals)

        # Rank by severity_score descending and return top 5-8
        deduped.sort(key=lambda s: s.severity_score, reverse=True)
        return deduped[:max_signals]

    # ---------------------------------------------------------------------------
    # Signal Detectors
    # ---------------------------------------------------------------------------

    @classmethod
    def _detect_outliers(cls, df: pl.DataFrame, profile: DatasetProfile) -> list[DetectedSignal]:
        signals: list[DetectedSignal] = []
        total_rows = df.height
        if total_rows < 10:
            return signals

        skewed_cols: list[str] = []
        numeric_cols = [c for c in profile.columns if c.dtype_category == "numeric" and c.numeric_stats]

        for col in numeric_cols:
            col_name = col.name
            try:
                series = df[col_name].drop_nulls()
                if series.len() < 10:
                    continue

                q25 = float(series.quantile(0.25) or 0)
                q75 = float(series.quantile(0.75) or 0)
                iqr = q75 - q25

                if iqr > 0:
                    lower_bound = q25 - 1.5 * iqr
                    upper_bound = q75 + 1.5 * iqr
                    outliers_count = series.filter((series < lower_bound) | (series > upper_bound)).len()
                    outlier_ratio = outliers_count / total_rows

                    # Surface only if in interesting band: 0.5% - 15%
                    if 0.005 <= outlier_ratio <= 0.15:
                        stat_sig = min(1.0, outlier_ratio / 0.05)
                        biz_rel = cls._calc_business_relevance(col, profile)
                        sev_score = min(1.0, stat_sig * biz_rel)

                        signals.append(
                            DetectedSignal(
                                id=f"outlier_{col_name}",
                                signal_type="outlier",
                                title=f"Outlier Spike in {col_name.replace('_', ' ').title()}",
                                description=f"Detected {outliers_count} anomalous data points ({outlier_ratio*100:.1f}% of records) beyond normal IQR bounds.",
                                columns=[col_name],
                                severity_score=round(sev_score, 3),
                                statistical_significance=round(stat_sig, 3),
                                business_relevance=round(biz_rel, 3),
                                details={
                                    "outlier_count": outliers_count,
                                    "outlier_ratio": round(outlier_ratio, 4),
                                    "lower_bound": round(lower_bound, 2),
                                    "upper_bound": round(upper_bound, 2),
                                    "iqr": round(iqr, 2)
                                }
                            )
                        )

                # Check if high skew for IsolationForest multivariate run
                skew = col.numeric_stats.get("skewness")
                if skew is not None and abs(skew) > 1.0:
                    skewed_cols.append(col_name)

            except Exception as e:
                logger.debug(f"Outlier detection failed for {col_name}: {e}")

        # Multivariate Isolation Forest for high-skew numeric columns
        if len(numeric_cols) >= 2 and total_rows >= 20:
            try:
                num_col_names = [c.name for c in numeric_cols]
                sub_df = df.select(num_col_names).to_pandas().fillna(0)
                iso = IsolationForest(n_estimators=50, contamination=0.05, random_state=42)
                preds = iso.fit_predict(sub_df)
                multi_outliers = int(np.sum(preds == -1))
                multi_ratio = multi_outliers / total_rows

                if 0.005 <= multi_ratio <= 0.15:
                    stat_sig = min(1.0, multi_ratio / 0.05)
                    primary = next((c for c in numeric_cols if c.is_primary_metric), numeric_cols[0])
                    biz_rel = cls._calc_business_relevance(primary, profile)
                    sev_score = min(1.0, stat_sig * biz_rel)

                    signals.append(
                        DetectedSignal(
                            id="multivariate_outlier_cluster",
                            signal_type="multivariate_outlier",
                            title="Multivariate Outlier Pattern Detected",
                            description=f"Isolation Forest identified {multi_outliers} multi-dimensional anomalous records ({multi_ratio*100:.1f}%) across numerical attributes.",
                            columns=num_col_names[:3],
                            severity_score=round(sev_score, 3),
                            statistical_significance=round(stat_sig, 3),
                            business_relevance=round(biz_rel, 3),
                            details={
                                "anomalous_rows": multi_outliers,
                                "anomalous_pct": round(multi_ratio * 100, 2),
                                "evaluated_columns": num_col_names
                            }
                        )
                    )
            except Exception as e:
                logger.debug(f"Multivariate outlier detection failed: {e}")

        return signals

    @classmethod
    def _detect_distribution_shifts(cls, df: pl.DataFrame, profile: DatasetProfile) -> list[DetectedSignal]:
        signals: list[DetectedSignal] = []
        date_col = next((c for c in profile.columns if c.is_primary_date or c.dtype_category == "datetime"), None)
        if not date_col or df.height < 30:
            return signals

        date_name = date_col.name
        numeric_cols = [c for c in profile.columns if c.dtype_category == "numeric"]
        if not numeric_cols:
            return signals

        try:
            # Parse datetime column to polars Datetime
            sub_df = df.select([date_name] + [c.name for c in numeric_cols]).drop_nulls(subset=[date_name])
            if sub_df.height < 30:
                return signals

            # Sort by date
            sub_df = sub_df.sort(date_name)
            total_rows = sub_df.height

            # Bucket into 5 to 10 time periods
            n_buckets = max(4, min(10, total_rows // 15))
            bucket_size = total_rows // n_buckets

            for num_c in numeric_cols:
                c_name = num_c.name
                vals = sub_df[c_name].to_numpy()
                overall_mean = float(np.nanmean(vals))
                overall_std = float(np.nanstd(vals))

                if overall_std <= 1e-8 or np.isnan(overall_mean):
                    continue

                dates = sub_df[date_name].to_list()

                for b in range(n_buckets):
                    start_idx = b * bucket_size
                    end_idx = total_rows if b == n_buckets - 1 else (b + 1) * bucket_size
                    bucket_vals = vals[start_idx:end_idx]

                    if len(bucket_vals) < 5:
                        continue

                    b_mean = float(np.nanmean(bucket_vals))
                    z_score = (b_mean - overall_mean) / overall_std

                    if abs(z_score) >= 2.0:
                        pct_change = ((b_mean - overall_mean) / abs(overall_mean)) * 100.0 if overall_mean != 0 else 0.0
                        stat_sig = min(1.0, abs(z_score) / 4.0)
                        biz_rel = cls._calc_business_relevance(num_c, profile)
                        sev_score = min(1.0, stat_sig * biz_rel)

                        start_date = str(dates[start_idx])[:10]
                        end_date = str(dates[min(end_idx - 1, total_rows - 1)])[:10]

                        direction = "sharp increase" if z_score > 0 else "significant drop"
                        signals.append(
                            DetectedSignal(
                                id=f"shift_{c_name}_b{b}",
                                signal_type="distribution_shift",
                                title=f"Distribution Shift in {c_name.replace('_', ' ').title()}",
                                description=f"Observed a {direction} ({pct_change:+.1f}%, z={z_score:.2f}) during period {start_date} to {end_date}.",
                                columns=[c_name, date_name],
                                severity_score=round(sev_score, 3),
                                statistical_significance=round(stat_sig, 3),
                                business_relevance=round(biz_rel, 3),
                                details={
                                    "period_start": start_date,
                                    "period_end": end_date,
                                    "bucket_mean": round(b_mean, 2),
                                    "overall_mean": round(overall_mean, 2),
                                    "z_score": round(z_score, 2),
                                    "pct_change": round(pct_change, 2)
                                }
                            )
                        )
                        # Limit 1 shift signal per column to avoid noise
                        break

        except Exception as e:
            logger.debug(f"Distribution shift detection failed: {e}")

        return signals

    @classmethod
    def _detect_correlation_signals(cls, profile: DatasetProfile) -> list[DetectedSignal]:
        signals: list[DetectedSignal] = []
        if not profile.correlation_matrix or not profile.correlation_matrix.columns:
            return signals

        cols = profile.correlation_matrix.columns
        matrix = profile.correlation_matrix.matrix
        col_map = {c.name: c for c in profile.columns}

        for i in range(len(cols)):
            for j in range(i + 1, len(cols)):
                c1_name, c2_name = cols[i], cols[j]
                r_val = matrix[i][j]
                if r_val is None:
                    continue

                c1 = col_map.get(c1_name)
                c2 = col_map.get(c2_name)
                if not c1 or not c2:
                    continue

                biz_rel = (cls._calc_business_relevance(c1, profile) + cls._calc_business_relevance(c2, profile)) / 2.0

                if r_val >= 0.80:
                    stat_sig = min(1.0, r_val)
                    sev_score = min(1.0, stat_sig * biz_rel)
                    signals.append(
                        DetectedSignal(
                            id=f"corr_pos_{c1_name}_{c2_name}",
                            signal_type="high_correlation",
                            title=f"Strong Correlation: {c1_name.replace('_', ' ').title()} & {c2_name.replace('_', ' ').title()}",
                            description=f"High positive correlation (r={r_val:.2f}) indicates these columns move together and may be redundant.",
                            columns=[c1_name, c2_name],
                            severity_score=round(sev_score, 3),
                            statistical_significance=round(stat_sig, 3),
                            business_relevance=round(biz_rel, 3),
                            details={"r": round(r_val, 3), "relationship": "positive"}
                        )
                    )
                elif r_val <= -0.80:
                    stat_sig = min(1.0, abs(r_val))
                    sev_score = min(1.0, stat_sig * biz_rel)
                    signals.append(
                        DetectedSignal(
                            id=f"corr_neg_{c1_name}_{c2_name}",
                            signal_type="inverse_relationship",
                            title=f"Inverse Relationship: {c1_name.replace('_', ' ').title()} & {c2_name.replace('_', ' ').title()}",
                            description=f"Strong negative correlation (r={r_val:.2f}) observed; as {c1_name} increases, {c2_name} decreases.",
                            columns=[c1_name, c2_name],
                            severity_score=round(sev_score, 3),
                            statistical_significance=round(stat_sig, 3),
                            business_relevance=round(biz_rel, 3),
                            details={"r": round(r_val, 3), "relationship": "negative"}
                        )
                    )

        # Mutual Information non-linear callouts
        if profile.mutual_information and profile.mutual_information.mi_computed:
            target = profile.mutual_information.target_column
            for item in profile.mutual_information.scores:
                c_name = item.get("column")
                mi_val = item.get("mi_score", 0.0)
                if mi_val >= 0.65 and c_name and c_name != target:
                    c_obj = col_map.get(c_name)
                    if c_obj:
                        biz_rel = cls._calc_business_relevance(c_obj, profile)
                        stat_sig = min(1.0, mi_val)
                        sev_score = min(1.0, stat_sig * biz_rel)
                        signals.append(
                            DetectedSignal(
                                id=f"mi_{c_name}_{target}",
                                signal_type="high_correlation",
                                title=f"High Non-Linear Relationship: {c_name} & {target}",
                                description=f"Mutual Information score of {mi_val:.2f} detected non-linear predictive coupling.",
                                columns=[c_name, target],
                                severity_score=round(sev_score, 3),
                                statistical_significance=round(stat_sig, 3),
                                business_relevance=round(biz_rel, 3),
                                details={"mi_score": round(mi_val, 3), "relationship": "non_linear"}
                            )
                        )

        return signals

    @classmethod
    def _detect_missingness_clusters(cls, df: pl.DataFrame, profile: DatasetProfile) -> list[DetectedSignal]:
        signals: list[DetectedSignal] = []
        null_cols = [c for c in profile.columns if c.null_percentage > 0.0]
        if len(null_cols) < 2 or df.height < 10:
            return signals

        col_names = [c.name for c in null_cols]
        col_map = {c.name: c for c in null_cols}

        try:
            # Build missingness boolean mask matrix
            null_masks = {name: df[name].is_null().to_numpy() for name in col_names}
            counts = {name: int(np.sum(mask)) for name, mask in null_masks.items()}

            for i in range(len(col_names)):
                name_a = col_names[i]
                count_a = counts[name_a]
                if count_a < 5:
                    continue
                mask_a = null_masks[name_a]

                for j in range(i + 1, len(col_names)):
                    name_b = col_names[j]
                    mask_b = null_masks[name_b]

                    both_missing = int(np.sum(mask_a & mask_b))
                    co_occur_ratio = both_missing / count_a

                    if co_occur_ratio >= 0.60:
                        c_a = col_map[name_a]
                        c_b = col_map[name_b]
                        biz_rel = (cls._calc_business_relevance(c_a, profile) + cls._calc_business_relevance(c_b, profile)) / 2.0
                        stat_sig = min(1.0, co_occur_ratio)
                        sev_score = min(1.0, stat_sig * biz_rel)

                        signals.append(
                            DetectedSignal(
                                id=f"missing_cluster_{name_a}_{name_b}",
                                signal_type="missingness_cluster",
                                title=f"Missingness Cluster: {name_a.replace('_', ' ').title()} & {name_b.replace('_', ' ').title()}",
                                description=f"When '{name_a}' is missing, '{name_b}' is also missing in {co_occur_ratio*100:.1f}% of cases ({both_missing} rows). Points to systematic data capture issue.",
                                columns=[name_a, name_b],
                                severity_score=round(sev_score, 3),
                                statistical_significance=round(stat_sig, 3),
                                business_relevance=round(biz_rel, 3),
                                details={
                                    "col_a": name_a,
                                    "col_b": name_b,
                                    "co_occurrence_pct": round(co_occur_ratio * 100, 1),
                                    "co_occurrence_count": both_missing
                                }
                            )
                        )
        except Exception as e:
            logger.debug(f"Missingness cluster detection failed: {e}")

        return signals

    @classmethod
    def _detect_category_imbalance(cls, df: pl.DataFrame, profile: DatasetProfile) -> list[DetectedSignal]:
        signals: list[DetectedSignal] = []
        cat_cols = [c for c in profile.columns if c.dtype_category == "categorical" and c.top_values]
        total_rows = df.height
        if total_rows < 10:
            return signals

        for col in cat_cols:
            top_vals = col.top_values
            if not top_vals:
                continue

            top_item = top_vals[0]
            top_count = top_item.get("count", 0)
            top_val_name = top_item.get("value", "Unknown")
            share = top_count / total_rows

            if share >= 0.80:
                # Compute Gini impurity: G = 1 - sum(p_i^2)
                counts = [v.get("count", 0) for v in top_vals]
                sum_c = sum(counts)
                gini = 1.0 - sum((c / sum_c) ** 2 for c in counts) if sum_c > 0 else 0.0

                stat_sig = min(1.0, share)
                biz_rel = cls._calc_business_relevance(col, profile)
                sev_score = min(1.0, stat_sig * biz_rel)

                signals.append(
                    DetectedSignal(
                        id=f"imbalance_{col.name}",
                        signal_type="category_imbalance",
                        title=f"Category Imbalance in {col.name.replace('_', ' ').title()}",
                        description=f"Dominant value '{top_val_name}' accounts for {share*100:.1f}% of all records (Gini impurity={gini:.2f}).",
                        columns=[col.name],
                        severity_score=round(sev_score, 3),
                        statistical_significance=round(stat_sig, 3),
                        business_relevance=round(biz_rel, 3),
                        details={
                            "dominant_value": str(top_val_name),
                            "dominant_share_pct": round(share * 100, 1),
                            "gini_impurity": round(gini, 3),
                            "cardinality": col.cardinality
                        }
                    )
                )

        return signals

    # ---------------------------------------------------------------------------
    # Helper & Scoring Functions
    # ---------------------------------------------------------------------------

    @classmethod
    def _calc_business_relevance(cls, col: ColumnProfile, profile: DatasetProfile) -> float:
        """
        Computes business relevance proxy score for a column based on role and quality:
        - Primary metric/category/date: +0.3
        - Non-ID column: +0.2
        - Reasonable missingness (<30%): +0.1
        - Base: 0.4
        """
        score = 0.4
        if col.is_primary_metric or col.is_primary_category or col.is_primary_date or col.is_primary_geo:
            score += 0.3
        if col.inferred_role != "identifier" and col.dtype_category != "id_like":
            score += 0.2
        if col.null_percentage < 30.0:
            score += 0.1
        return min(1.0, score)

    @classmethod
    def _deduplicate_signals(cls, signals: list[DetectedSignal]) -> list[DetectedSignal]:
        seen_keys: set[str] = set()
        deduped: list[DetectedSignal] = []

        for s in signals:
            key = f"{s.signal_type}_{'_'.join(sorted(s.columns))}"
            if key not in seen_keys:
                seen_keys.add(key)
                deduped.append(s)

        return deduped
