import logging
from typing import Any

import polars as pl
from pydantic import BaseModel

from .engine import _load_df
from .semantic_layer import semantic_layer

logger = logging.getLogger("snowpulse.analytics.query_builder")

class QueryFilter(BaseModel):
    column: str
    op: str  # e.g., '==', '!=', '>', '<', '>=', '<=', 'in', 'between'
    value: Any

class QueryMetric(BaseModel):
    column: str
    agg: str  # 'sum', 'avg', 'count', 'min', 'max'

class QueryPayload(BaseModel):
    dimensions: list[str] = []
    metrics: list[QueryMetric] = []
    filters: list[QueryFilter] = []

    # Semantic Layer Support
    semantic_model_name: str | None = None
    semantic_dimensions: list[str] = []
    semantic_metrics: list[str] = []

    sort_by: str | None = None
    sort_desc: bool = True
    limit: int = 100

class DashboardAggregatePayload(BaseModel):
    filters: list[QueryFilter] = []
    active_category_values: dict[str, list[str]] = {}
    active_numeric_ranges: dict[str, list[float]] = {}
    date_range: dict[str, str] | None = None
    active_brush: dict[str, Any] | None = None

class DynamicQueryEngine:
    @staticmethod
    def execute_query(file_path: str, query: QueryPayload) -> dict[str, Any]:
        """
        Takes a JSON payload describing filters, dimensions, and aggregations,
        and translates it into highly optimized Polars dataframe operations.
        Resolves semantic metrics and dimensions if a semantic model is provided.
        """
        try:
            # Semantic Layer Resolution
            if query.semantic_model_name:
                for s_metric in query.semantic_metrics:
                    m_def = semantic_layer.resolve_metric(query.semantic_model_name, s_metric)
                    if m_def:
                        # Convert semantic metric to physical metric
                        query.metrics.append(QueryMetric(column=m_def.column, agg=m_def.agg))
                    else:
                        logger.warning(f"Semantic metric '{s_metric}' not found in model '{query.semantic_model_name}'.")

                for s_dim in query.semantic_dimensions:
                    d_def = semantic_layer.resolve_dimension(query.semantic_model_name, s_dim)
                    if d_def:
                        query.dimensions.append(d_def.column)
                    else:
                        logger.warning(f"Semantic dimension '{s_dim}' not found in model '{query.semantic_model_name}'.")

            df = _load_df(file_path)

            # Apply Filters
            for f in query.filters:
                if f.column not in df.columns:
                    continue

                # Dynamic polars filtering
                if f.op == '==':
                    df = df.filter(pl.col(f.column) == f.value)
                elif f.op == '!=':
                    df = df.filter(pl.col(f.column) != f.value)
                elif f.op == '>':
                    df = df.filter(pl.col(f.column) > f.value)
                elif f.op == '<':
                    df = df.filter(pl.col(f.column) < f.value)
                elif f.op == '>=':
                    df = df.filter(pl.col(f.column) >= f.value)
                elif f.op == '<=':
                    df = df.filter(pl.col(f.column) <= f.value)
                elif f.op == 'in' and isinstance(f.value, list):
                    df = df.filter(pl.col(f.column).is_in(f.value))
                elif f.op == 'between' and isinstance(f.value, (list, tuple)) and len(f.value) == 2:
                    df = df.filter((pl.col(f.column) >= f.value[0]) & (pl.col(f.column) <= f.value[1]))

            # Grouping and Aggregation
            if query.metrics:
                aggs = []
                for m in query.metrics:
                    if m.column not in df.columns:
                        continue
                    if m.agg == 'sum':
                        aggs.append(pl.col(m.column).sum().alias(f"{m.column}_{m.agg}"))
                    elif m.agg == 'avg':
                        aggs.append(pl.col(m.column).mean().alias(f"{m.column}_{m.agg}"))
                    elif m.agg == 'count':
                        aggs.append(pl.col(m.column).count().alias(f"{m.column}_{m.agg}"))
                    elif m.agg == 'min':
                        aggs.append(pl.col(m.column).min().alias(f"{m.column}_{m.agg}"))
                    elif m.agg == 'max':
                        aggs.append(pl.col(m.column).max().alias(f"{m.column}_{m.agg}"))

                if query.dimensions:
                    valid_dims = [d for d in query.dimensions if d in df.columns]
                    if valid_dims and aggs:
                        df = df.group_by(valid_dims).agg(aggs)
                elif aggs:
                    df = df.select(aggs)

            # Sorting
            if query.sort_by and query.sort_by in df.columns:
                df = df.sort(query.sort_by, descending=query.sort_desc)

            # Limiting
            if query.limit > 0:
                df = df.head(query.limit)

            columns = df.columns
            rows = df.to_dicts()

            return {
                "success": True,
                "columns": columns,
                "data": rows,
                "total_rows": len(rows)
            }
        except Exception as e:
            logger.error(f"Dynamic query failure: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    @staticmethod
    def execute_dashboard_aggregation(file_path: str, payload: DashboardAggregatePayload) -> dict[str, Any]:
        """
        Executes server-side filtering and aggregation for the unified dashboard.
        Returns pre-aggregated stats, group-bys, and distributions without returning raw rows.
        """
        try:
            df = _load_df(file_path)

            # 1. Apply explicit filters
            for f in payload.filters:
                if f.column in df.columns:
                    if f.op == '==' or f.op == 'eq':
                        df = df.filter(pl.col(f.column) == f.value)
                    elif f.op == '!=':
                        df = df.filter(pl.col(f.column) != f.value)
                    elif f.op == '>':
                        df = df.filter(pl.col(f.column) > f.value)
                    elif f.op == '<':
                        df = df.filter(pl.col(f.column) < f.value)
                    elif f.op == 'in' and isinstance(f.value, list):
                        df = df.filter(pl.col(f.column).is_in(f.value))
                    elif f.op == 'between' and isinstance(f.value, (list, tuple)) and len(f.value) == 2:
                        df = df.filter((pl.col(f.column) >= f.value[0]) & (pl.col(f.column) <= f.value[1]))

            # 2. Apply active_category_values filter map
            for col, values in payload.active_category_values.items():
                if col in df.columns and values:
                    df = df.filter(pl.col(col).is_in(values))

            # 3. Apply active_numeric_ranges filter map
            for col, r in payload.active_numeric_ranges.items():
                if col in df.columns and isinstance(r, (list, tuple)) and len(r) == 2:
                    df = df.filter((pl.col(col) >= r[0]) & (pl.col(col) <= r[1]))

            # 4. Apply date_range filter
            if payload.date_range and 'start' in payload.date_range and 'end' in payload.date_range:
                date_cols = [c for c in df.columns if 'date' in c.lower() or 'time' in c.lower()]
                if date_cols:
                    d_col = date_cols[0]
                    df = df.filter((pl.col(d_col) >= payload.date_range['start']) & (pl.col(d_col) <= payload.date_range['end']))

            filtered_rows = len(df)

            # Separate numeric and categorical columns
            numeric_cols = [c for c, dtype in zip(df.columns, df.dtypes) if dtype in (pl.Float64, pl.Float32, pl.Int64, pl.Int32, pl.Int16, pl.Int8)]
            cat_cols = [c for c, dtype in zip(df.columns, df.dtypes) if dtype in (pl.Utf8, pl.Categorical, pl.Boolean)]

            kpis = {}
            for col in numeric_cols:
                if len(df) > 0:
                    mean_val = df[col].mean()
                    sum_val = df[col].sum()
                    min_val = df[col].min()
                    max_val = df[col].max()
                    kpis[col] = {
                        "mean": float(mean_val) if mean_val is not None else 0.0,
                        "sum": float(sum_val) if sum_val is not None else 0.0,
                        "min": float(min_val) if min_val is not None else 0.0,
                        "max": float(max_val) if max_val is not None else 0.0,
                    }
                else:
                    kpis[col] = {"mean": 0.0, "sum": 0.0, "min": 0.0, "max": 0.0}

            categorical_breakdowns = {}
            for col in cat_cols[:4]:
                if len(df) > 0:
                    counts = df.group_by(col).len().sort("len", descending=True).head(10)
                    categorical_breakdowns[col] = counts.to_dicts()

            return {
                "success": True,
                "total_records": filtered_rows,
                "kpis": kpis,
                "categorical_breakdowns": categorical_breakdowns,
            }
        except Exception as e:
            logger.error(f"Dashboard aggregation failure: {e}")
            return {
                "success": False,
                "error": str(e),
                "total_records": 0,
                "kpis": {},
                "categorical_breakdowns": {}
            }

