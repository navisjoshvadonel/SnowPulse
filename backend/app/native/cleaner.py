"""
SnowPulse AI - Native Data Preprocessor & Cleaning Studio Engine.
Enterprise-grade tabular data cleaning, missing value imputation,
outlier remediation (Winsorization/IQR), deduplication, and transformation tracking.
"""

from typing import Any

import numpy as np
import polars as pl

from ..analytics.profiler import DatasetProfiler


class NativeDataPreprocessor:
    """
    Autonomous and interactive data cleaning and preprocessing pipeline.
    Transforms raw, noisy datasets into production-ready analytical assets.
    """

    @classmethod
    def audit(cls, df: pl.DataFrame) -> dict[str, Any]:
        """
        Conducts a pre-cleaning diagnostic audit of raw dataset quality,
        detecting nulls, duplicates, outliers, and semantic roles.
        """
        total_rows = df.height
        total_cols = df.width
        total_cells = total_rows * total_cols if total_cols > 0 else 1

        profile = DatasetProfiler.profile_full(df)

        # 1. Missing cell audit
        missing_by_col = []
        total_missing = 0
        for col_profile in profile.columns:
            null_count = int(round((col_profile.null_percentage / 100.0) * total_rows))
            if null_count > 0:
                total_missing += null_count
                suggested = "median" if col_profile.dtype_category == "numeric" else "mode"
                missing_by_col.append({
                    "column": col_profile.name,
                    "null_count": null_count,
                    "null_pct": round(col_profile.null_percentage, 1),
                    "dtype": col_profile.dtype_category,
                    "suggested_strategy": suggested,
                })

        # 2. Duplicate rows audit
        dup_count = total_rows - df.unique().height if total_rows > 0 else 0
        dup_pct = round((dup_count / max(total_rows, 1)) * 100.0, 2)

        # 3. Outlier audit (IQR method for numeric columns)
        numeric_cols = [c.name for c in profile.columns if c.dtype_category == "numeric"]
        outlier_audit = []
        for col in numeric_cols:
            if col in df.columns:
                series = df[col].drop_nulls()
                if len(series) >= 10:
                    arr = series.to_numpy()
                    q25 = float(np.percentile(arr, 25))
                    q75 = float(np.percentile(arr, 75))
                    iqr = q75 - q25
                    lower_bound = q25 - 1.5 * iqr
                    upper_bound = q75 + 1.5 * iqr
                    outliers_count = int(np.sum((arr < lower_bound) | (arr > upper_bound)))
                    if outliers_count > 0:
                        outlier_audit.append({
                            "column": col,
                            "outlier_count": outliers_count,
                            "outlier_pct": round((outliers_count / len(series)) * 100.0, 1),
                            "q25": round(q25, 2),
                            "q75": round(q75, 2),
                            "lower_bound": round(lower_bound, 2),
                            "upper_bound": round(upper_bound, 2),
                        })

        # 4. Inferred Identifiers (IDs/UUIDs/Keys)
        identifiers = [
            c.name for c in profile.columns
            if c.inferred_role == "identifier" or c.dtype_category in ["id_like", "unknown"] or c.cardinality_ratio > 0.6
        ]

        # 5. Raw Health Score
        completeness = max(0.0, 1.0 - (total_missing / max(total_cells, 1)))
        uniqueness = max(0.0, 1.0 - (dup_count / max(total_rows, 1)))
        outlier_penalty = min(0.2, (len(outlier_audit) / max(len(numeric_cols), 1)) * 0.15) if numeric_cols else 0.0
        health_score = round(max(0.0, (completeness * 0.6 + uniqueness * 0.4) - outlier_penalty) * 100.0, 1)

        outliers_detected = 0
        for o in outlier_audit:
            outliers_detected += int(float(o["outlier_count"]))

        return {
            "total_rows": total_rows,
            "total_columns": total_cols,
            "total_cells": total_cells,
            "total_missing_cells": total_missing,
            "overall_missing_pct": round((total_missing / max(total_cells, 1)) * 100.0, 2),
            "duplicate_rows_count": dup_count,
            "duplicate_rows_pct": dup_pct,
            "columns_with_missing": missing_by_col,
            "outlier_columns": outlier_audit,
            "outliers_detected": outliers_detected,
            "detected_identifiers": identifiers,
            "raw_health_score": health_score,
            "health_score": health_score,
            "rows": total_rows,
            "columns": total_cols,
            "total_missing": total_missing,
            "missing_cols_count": len(missing_by_col),
            "duplicate_rows": dup_count,
            "needs_cleaning": bool(total_missing > 0 or dup_count > 0 or len(outlier_audit) > 0),
        }

    @classmethod
    def clean(cls, df: pl.DataFrame, config: dict[str, Any] | None = None) -> tuple[pl.DataFrame, dict[str, Any]]:
        """
        Executes the configured preprocessing and cleaning transformations.
        Returns the clean DataFrame and a comprehensive audit report of changes made.
        """
        cfg = config or {}
        deduplicate = cfg.get("deduplicate", True)
        missing_num_strategy = cfg.get("missing_numeric_strategy", "median")
        missing_cat_strategy = cfg.get("missing_categorical_strategy", "mode")
        outlier_strategy = cfg.get("outlier_strategy", "clip")  # "clip", "drop", "keep"
        normalize_text = cfg.get("normalize_text", True)
        parse_dates = cfg.get("parse_dates", True)
        drop_identifiers = cfg.get("drop_identifiers", False)
        col_overrides = cfg.get("column_strategies", {})

        audit_before = cls.audit(df)
        working_df = df.clone()
        transformations: list[str] = []

        # Step 1: Normalize text whitespace and null tokens
        if normalize_text:
            text_exprs = []
            for col in working_df.columns:
                if working_df[col].dtype == pl.String:
                    text_exprs.append(
                        pl.col(col)
                        .str.strip_chars()
                        .replace("", None)
                        .replace("N/A", None)
                        .replace("n/a", None)
                        .replace("null", None)
                        .replace("NULL", None)
                        .replace("NaN", None)
                        .replace("nan", None)
                        .alias(col)
                    )
            if text_exprs:
                working_df = working_df.with_columns(text_exprs)
                transformations.append(f"Standardized string whitespace and null tokens across {len(text_exprs)} text columns")

        # Step 2: Deduplication
        if deduplicate and audit_before["duplicate_rows_count"] > 0:
            initial_count = working_df.height
            working_df = working_df.unique()
            removed = initial_count - working_df.height
            transformations.append(f"Deduplicated dataset: removed {removed:,} redundant row instances")

        # Step 3: Date parsing
        if parse_dates:
            date_exprs = []
            for col in working_df.columns:
                if working_df[col].dtype == pl.String and ("date" in col.lower() or "time" in col.lower() or "created" in col.lower()):
                    try:
                        date_exprs.append(pl.col(col).str.to_datetime(strict=False).alias(col))
                    except Exception:
                        pass
            if date_exprs:
                working_df = working_df.with_columns(date_exprs)
                transformations.append(f"Parsed {len(date_exprs)} temporal columns into datetime format")

        # Step 4: Missing Value Imputation / Handling
        for col_info in audit_before["columns_with_missing"]:
            col = col_info["column"]
            if col not in working_df.columns:
                continue

            null_count = working_df[col].null_count()
            if null_count == 0:
                continue

            strat = col_overrides.get(col)
            if not strat:
                strat = missing_num_strategy if col_info["dtype"] == "numeric" else missing_cat_strategy

            if strat == "drop_rows":
                working_df = working_df.drop_nulls(subset=[col])
                transformations.append(f"Dropped {null_count:,} rows with missing values in '{col}'")
            elif strat == "median" and col_info["dtype"] == "numeric":
                val = working_df[col].median()
                if val is not None:
                    working_df = working_df.with_columns(pl.col(col).fill_null(val).alias(col))
                    transformations.append(f"Imputed {null_count:,} missing values in '{col}' with median ({float(val):.2f})")
            elif strat == "mean" and col_info["dtype"] == "numeric":
                val = working_df[col].mean()
                if val is not None:
                    working_df = working_df.with_columns(pl.col(col).fill_null(val).alias(col))
                    transformations.append(f"Imputed {null_count:,} missing values in '{col}' with mean ({float(val):.2f})")
            elif strat == "zero" and col_info["dtype"] == "numeric":
                working_df = working_df.with_columns(pl.col(col).fill_null(0).alias(col))
                transformations.append(f"Imputed {null_count:,} missing values in '{col}' with 0")
            elif strat == "mode":
                # Most frequent value
                vc = working_df[col].drop_nulls().value_counts().sort("count", descending=True)
                if len(vc) > 0:
                    mode_val = vc[col][0]
                    working_df = working_df.with_columns(pl.col(col).fill_null(mode_val).alias(col))
                    transformations.append(f"Imputed {null_count:,} missing values in '{col}' with mode ('{mode_val}')")
            elif strat == "constant":
                working_df = working_df.with_columns(pl.col(col).fill_null("Unknown").alias(col))
                transformations.append(f"Imputed {null_count:,} missing values in '{col}' with constant 'Unknown'")

        # Step 5: Outlier Remediation (Winsorization / Clipping or Dropping)
        if outlier_strategy in ["clip", "drop"] and audit_before["outlier_columns"]:
            for out_info in audit_before["outlier_columns"]:
                col = out_info["column"]
                if col in working_df.columns:
                    lb = out_info["lower_bound"]
                    ub = out_info["upper_bound"]
                    if outlier_strategy == "clip":
                        working_df = working_df.with_columns(
                            pl.when(pl.col(col) < lb)
                            .then(lb)
                            .when(pl.col(col) > ub)
                            .then(ub)
                            .otherwise(pl.col(col))
                            .alias(col)
                        )
                        transformations.append(f"Winsorized {out_info['outlier_count']} outliers in '{col}' within IQR fences [{lb}, {ub}]")
                    elif outlier_strategy == "drop":
                        working_df = working_df.filter((pl.col(col) >= lb) & (pl.col(col) <= ub))
                        transformations.append(f"Filtered out {out_info['outlier_count']} extreme outlier rows in '{col}'")

        # Step 6: Optional drop non-informative identifiers
        if drop_identifiers and audit_before["detected_identifiers"]:
            drop_cols = [c for c in audit_before["detected_identifiers"] if c in working_df.columns]
            if drop_cols:
                working_df = working_df.drop(drop_cols)
                transformations.append(f"Removed non-informative identifier columns: {', '.join(drop_cols)}")

        # Audit After Cleaning
        audit_after = cls.audit(working_df)

        missing_res = audit_before["total_missing_cells"] - audit_after["total_missing_cells"]
        clipped_count = sum(o["outlier_count"] for o in audit_before["outlier_columns"]) if outlier_strategy == "clip" else 0
        norm_cols_count = len([t for t in transformations if "Normalized" in t or "Cleaned string" in t or "Parsed datetime" in t])

        report = {
            "initial_rows": audit_before["total_rows"],
            "final_rows": audit_after["total_rows"],
            "rows_removed": audit_before["total_rows"] - audit_after["total_rows"],
            "initial_missing": audit_before["total_missing_cells"],
            "final_missing": audit_after["total_missing_cells"],
            "missing_resolved": missing_res,
            "resolved_missing": missing_res,
            "duplicates_removed": audit_before["duplicate_rows_count"],
            "outliers_clipped": clipped_count,
            "normalized_columns": norm_cols_count,
            "initial_health_score": audit_before["raw_health_score"],
            "final_health_score": audit_after["raw_health_score"],
            "health_improvement": round(audit_after["raw_health_score"] - audit_before["raw_health_score"], 1),
            "transformations": transformations,
            "recipe_applied": cfg,
        }

        return working_df, report
