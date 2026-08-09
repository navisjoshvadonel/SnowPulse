'''rules_engine.py

Provides a lightweight rule‑based scoring engine that inspects a
`DatasetProfile` (produced by ``DatasetProfiler``) together with the
underlying Polars ``DataFrame`` and produces a ranked list of chart
suggestions.

The engine follows the specification supplied by the user.  For each
supported pattern we:

1. Detect applicability using the profile flags (dtype_category,
   inferred_role, cardinality, etc.) and simple statistics on the
   ``DataFrame``.
2. Compute a numeric ``score`` – a weighted product of three factors:
   * ``statistical_significance`` – e.g. skewness, ANOVA eta‑squared,
     Pearson‑r magnitude, Chi‑square p‑value, etc.
   * ``visual_clarity`` – prefers low‑cardinality categorical axes,
     appropriate binning, and avoids over‑plotting.
   * ``data_completeness`` – penalises columns with high missingness.
3. Return a dictionary describing the chart type and the columns to use.

The public API is a single class ``ChartSuggester`` with a method
``suggest(self) -> list[dict]`` that returns the top‑ranked suggestions.
''' 

from __future__ import annotations

import math
from typing import Any, Callable, Dict, List, Tuple

import numpy as np
import polars as pl
from scipy import stats

from .profiler import DatasetProfile, ColumnProfile

# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------

def _outlier_ratio(series: pl.Series) -> float:
    """Return the proportion of points that are outliers according to the IQR method."""
    arr = series.drop_nulls().to_numpy()
    if len(arr) == 0:
        return 0.0
    q75, q25 = np.percentile(arr, [75, 25])
    iqr = q75 - q25
    lower = q25 - 1.5 * iqr
    upper = q75 + 1.5 * iqr
    outliers = ((arr < lower) | (arr > upper)).sum()
    return outliers / len(arr)

def _skewness(series: pl.Series) -> float:
    arr = series.drop_nulls().to_numpy()
    if len(arr) == 0:
        return 0.0
    return stats.skew(arr)

def _cardinality_ratio(col: ColumnProfile, total_rows: int) -> float:
    # column.profile already stores cardinality_ratio but guard against missing
    return getattr(col, "cardinality_ratio", 0.0)

def _missingness(series: pl.Series) -> float:
    return series.null_count() / series.len()

# ---------------------------------------------------------------------------
# Scoring helpers – each returns a tuple (score, details)
# ---------------------------------------------------------------------------

def _score_single_numeric(col: ColumnProfile, df: pl.DataFrame) -> Tuple[float, Dict[str, Any]]:
    series = df[col.name]
    skew = abs(_skewness(series))
    out_ratio = _outlier_ratio(series)
    # significance: strong skew or many outliers
    sig = (skew > 1) * 0.6 + (out_ratio > 0.05) * 0.4
    # clarity: numeric is always clear
    clr = 0.9
    # completeness: penalise missing data
    miss = _missingness(series)
    comp = 1 - miss
    score = sig * clr * comp
    chart = "histogram" if skew > 1 else "histogram_kde"
    details = {"chart": chart, "skew": skew, "outlier_ratio": out_ratio}
    return score, details

def _score_single_categorical(col: ColumnProfile, df: pl.DataFrame) -> Tuple[float, Dict[str, Any]]:
    cat_card = col.cardinality if hasattr(col, "cardinality") else df[col.name].n_unique()
    miss = _missingness(df[col.name])
    comp = 1 - miss
    if cat_card <= 8:
        chart = "pie"
        clr = 0.9
    elif cat_card <= 50:
        chart = "bar_horizontal"
        clr = 0.8
    else:
        chart = "bar_top_n"
        clr = 0.6
    sig = 0.7  # categorical by itself has limited statistical significance
    score = sig * clr * comp
    return score, {"chart": chart, "cardinality": cat_card}

def _score_single_datetime(col: ColumnProfile, df: pl.DataFrame) -> Tuple[float, Dict[str, Any]]:
    series = df[col.name]
    # simple missingness penalty
    miss = _missingness(series)
    comp = 1 - miss
    # clarity is good for time series
    clr = 0.9
    sig = 0.6
    score = sig * clr * comp
    return score, {"chart": "area_time", "missingness": miss}

def _score_numeric_numeric(col_a: ColumnProfile, col_b: ColumnProfile, df: pl.DataFrame) -> Tuple[float, Dict[str, Any]]:
    a = df[col_a.name].drop_nulls().to_numpy()
    b = df[col_b.name].drop_nulls().to_numpy()
    if len(a) < 2 or len(b) < 2:
        return 0.0, {}
    r = np.corrcoef(a, b)[0, 1]
    sig = min(abs(r), 1.0) * 0.7  # stronger correlation → higher significance
    clr = 0.8 if abs(r) > 0.3 else 0.5
    comp = 1 - (_missingness(df[col_a.name]) + _missingness(df[col_b.name])) / 2
    score = sig * clr * comp
    chart = "scatter" if abs(r) > 0.3 else "scatter_no_rel"
    return score, {"chart": chart, "pearson_r": r}

def _score_numeric_categorical(num: ColumnProfile, cat: ColumnProfile, df: pl.DataFrame) -> Tuple[float, Dict[str, Any]]:
    # Determine cardinality
    cat_card = cat.cardinality if hasattr(cat, "cardinality") else df[cat.name].n_unique()
    series_num = df[num.name].drop_nulls().to_numpy()
    series_cat = df[cat.name].drop_nulls()
    # Align lengths (simple left join on index)
    # Compute ANOVA effect size (eta squared) as a proxy
    groups = []
    for val in df[cat.name].unique().to_list():
        groups.append(df.filter(pl.col(cat.name) == val)[num.name].drop_nulls().to_numpy())
    # If not enough groups, fallback to simple variance between means
    if len(groups) < 2:
        eta2 = 0.0
    else:
        f_val, p_val = stats.f_oneway(*groups)
        # eta_squared = sum_sq_between / total_sum_sq approximated via p-value
        eta2 = max(0.0, 1 - p_val)  # rough proxy
    sig = eta2 * 0.7
    clr = 0.7 if cat_card <= 10 else 0.4
    comp = 1 - (_missingness(df[num.name]) + _missingness(df[cat.name])) / 2
    score = sig * clr * comp
    chart = "boxplot_grouped" if eta2 > 0.06 else "bar_means"
    return score, {"chart": chart, "eta_squared": eta2, "cardinality": cat_card}

def _score_categorical_categorical(col_a: ColumnProfile, col_b: ColumnProfile, df: pl.DataFrame) -> Tuple[float, Dict[str, Any]]:
    a = df[col_a.name].cast(pl.Categorical)
    b = df[col_b.name].cast(pl.Categorical)
    contingency = pl.crosstab(a, b)
    chi2, p, dof, _ = stats.chi2_contingency(contingency.to_numpy())
    sig = (1 - p) * 0.7
    clr = 0.8 if max(col_a.cardinality, col_b.cardinality) <= 15 else 0.5
    comp = 1 - (_missingness(df[col_a.name]) + _missingness(df[col_b.name])) / 2
    score = sig * clr * comp
    chart = "heatmap" if p < 0.05 else "grouped_bar"
    return score, {"chart": chart, "chi2_p": p, "cardinality_a": col_a.cardinality, "cardinality_b": col_b.cardinality}

# ---------------------------------------------------------------------------
# Main suggester class
# ---------------------------------------------------------------------------

class ChartSuggester:
    """Detect patterns in a dataset and rank chart suggestions.

    The class is deliberately lightweight – it does not depend on any UI
    framework.  The consumer (e.g. a FastAPI endpoint) can call ``suggest``
    and obtain a ready‑to‑render list of chart descriptors.
    """

    def __init__(self, df: pl.DataFrame, profile: DatasetProfile):
        self.df = df
        self.profile = profile
        self.total_rows = df.height
        # Pre‑compute missingness per column for reuse
        self._missing = {c.name: _missingness(df[c.name]) for c in profile.columns}

    # -------------------------------------------------------------------
    # Public API
    # -------------------------------------------------------------------
    def suggest(self, top_n: int = 3) -> List[Dict[str, Any]]:
        """Return the top‑N chart suggestions ordered by their score.

        Each suggestion dictionary contains:
        * ``score`` – numeric ranking value
        * ``chart`` – identifier (e.g. ``"scatter"``)
        * ``columns`` – list of column names required for the chart
        * ``details`` – algorithm‑specific auxiliary information
        """
        candidates: List[Tuple[float, Dict[str, Any]]] = []
        cols = self.profile.columns
        # ---------------------------------------------------------------
        # Single‑column patterns
        # ---------------------------------------------------------------
        for col in cols:
            if col.dtype_category == "numeric":
                score, details = _score_single_numeric(col, self.df)
                candidates.append((score, {"chart": details["chart"], "columns": [col.name], "score": score, "details": details}))
            elif col.dtype_category in {"categorical", "text"}:
                score, details = _score_single_categorical(col, self.df)
                candidates.append((score, {"chart": details["chart"], "columns": [col.name], "score": score, "details": details}))
            elif col.dtype_category == "datetime":
                score, details = _score_single_datetime(col, self.df)
                candidates.append((score, {"chart": details["chart"], "columns": [col.name], "score": score, "details": details}))
        # ---------------------------------------------------------------
        # Two‑column patterns
        # ---------------------------------------------------------------
        for i, col_a in enumerate(cols):
            for col_b in cols[i + 1 :]:
                # Numeric + Numeric
                if col_a.dtype_category == "numeric" and col_b.dtype_category == "numeric":
                    score, details = _score_numeric_numeric(col_a, col_b, self.df)
                    candidates.append((score, {"chart": details["chart"], "columns": [col_a.name, col_b.name], "score": score, "details": details}))
                # Numeric + Categorical
                if (
                    (col_a.dtype_category == "numeric" and col_b.dtype_category in {"categorical", "text"})
                    or (col_b.dtype_category == "numeric" and col_a.dtype_category in {"categorical", "text"})
                ):
                    num = col_a if col_a.dtype_category == "numeric" else col_b
                    cat = col_b if col_a.dtype_category == "numeric" else col_a
                    score, details = _score_numeric_categorical(num, cat, self.df)
                    candidates.append((score, {"chart": details["chart"], "columns": [num.name, cat.name], "score": score, "details": details}))
                # Categorical + Categorical
                if col_a.dtype_category in {"categorical", "text"} and col_b.dtype_category in {"categorical", "text"}:
                    # Apply cardinality filter (≤15) as spec
                    if getattr(col_a, "cardinality", 0) <= 15 and getattr(col_b, "cardinality", 0) <= 15:
                        score, details = _score_categorical_categorical(col_a, col_b, self.df)
                        candidates.append((score, {"chart": details["chart"], "columns": [col_a.name, col_b.name], "score": score, "details": details}))
        # ---------------------------------------------------------------
        # Global patterns (missing data matrix, ID exclusion, row‑count throttling)
        # ---------------------------------------------------------------
        high_missing = [c.name for c in cols if self._missing.get(c.name, 0) > 0.20]
        if high_missing:
            score = 0.5  # moderate priority
            candidates.append(
                (
                    score,
                    {
                        "chart": "missingness_heatmap",
                        "columns": high_missing,
                        "score": score,
                        "details": {"missing_columns": high_missing},
                    },
                )
            )
        # ID‑like columns exclusion – not a chart but a flag for downstream UI
        id_like = [c.name for c in cols if getattr(c, "cardinality_ratio", 0) > 0.95]
        if id_like:
            # No chart, but we store for UI to hide them
            candidates.append(
                (
                    0.0,
                    {"chart": "exclude_id_columns", "columns": id_like, "score": 0.0, "details": {"reason": "near‑unique"}},
                )
            )
        # ---------------------------------------------------------------
        # Rank and return top N (ignoring zero‑score exclusion entries)
        # ---------------------------------------------------------------
        ranked = sorted([c for c in candidates if c[0] > 0], key=lambda x: x[0], reverse=True)
        return [item[1] for item in ranked[:top_n]]
