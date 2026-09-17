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
    selectedRegion: str | None = None
    selectedCategory: str | None = None
    date_range: dict[str, str] | None = None
    dateRange: dict[str, str] | None = None
    brushedRange: list[float] | tuple[float, float] | None = None
    filters: list[QueryFilter] = []
    active_category_values: dict[str, list[str]] = {}
    active_numeric_ranges: dict[str, list[float]] = {}
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

            # Apply filters
            for f in query.filters:
                if f.column in df.columns:
                    if f.op == '==' or f.op == 'eq':
                        df = df.filter(pl.col(f.column) == f.value)
                    elif f.op == '!=':
                        df = df.filter(pl.col(f.column) != f.value)
                    elif f.op == '>=' or f.op == 'gte':
                        df = df.filter(pl.col(f.column) >= f.value)
                    elif f.op == '<=' or f.op == 'lte':
                        df = df.filter(pl.col(f.column) <= f.value)
                    elif f.op == '>':
                        df = df.filter(pl.col(f.column) > f.value)
                    elif f.op == '<':
                        df = df.filter(pl.col(f.column) < f.value)
                    elif f.op == 'in' and isinstance(f.value, list):
                        df = df.filter(pl.col(f.column).is_in(f.value))
                    elif f.op == 'between' and isinstance(f.value, (list, tuple)) and len(f.value) == 2:
                        df = df.filter((pl.col(f.column) >= f.value[0]) & (pl.col(f.column) <= f.value[1]))

            # Apply aggregations
            aggs = []
            for m in query.metrics:
                if m.column in df.columns:
                    if m.agg == 'sum':
                        aggs.append(pl.col(m.column).sum().alias(f"{m.column}_sum"))
                    elif m.agg == 'avg' or m.agg == 'mean':
                        aggs.append(pl.col(m.column).mean().alias(f"{m.column}_avg"))
                    elif m.agg == 'count':
                        aggs.append(pl.col(m.column).count().alias(f"{m.column}_count"))
                    elif m.agg == 'min':
                        aggs.append(pl.col(m.column).min().alias(f"{m.column}_min"))
                    elif m.agg == 'max':
                        aggs.append(pl.col(m.column).max().alias(f"{m.column}_max"))

            valid_dims = [d for d in query.dimensions if d in df.columns]

            if valid_dims:
                grouped = df.group_by(valid_dims)
                if aggs:
                    result_df = grouped.agg(aggs)
                else:
                    result_df = grouped.len()
            else:
                if aggs:
                    result_df = df.select(aggs)
                else:
                    result_df = df.head(query.limit)

            # Sorting
            if query.sort_by and query.sort_by in result_df.columns:
                result_df = result_df.sort(query.sort_by, descending=query.sort_desc)

            # Limit
            result_df = result_df.head(query.limit)

            # Convert to python dict format
            data = result_df.to_dicts()
            return {
                "success": True,
                "data": data,
                "row_count": len(data),
                "total_rows": len(data),
                "columns": result_df.columns
            }
        except Exception as e:
            logger.error(f"Query execution failure: {e}")
            return {
                "success": False,
                "error": str(e),
                "data": [],
                "row_count": 0,
                "total_rows": 0
            }

    @staticmethod
    def execute_dashboard_aggregation(file_path: str, payload: DashboardAggregatePayload) -> dict[str, Any]:
        """
        Executes server-side filtering and aggregation for the unified dashboard.
        Returns pre-aggregated stats, group-bys, correlations, and distributions without returning raw rows.
        """
        try:
            from .profiler import DatasetProfiler
            df = _load_df(file_path)

            # 1. Selected Region filter
            region_val = payload.selectedRegion
            if region_val:
                geo_cols = [c for c in df.columns if any(k in c.lower() for k in ['region', 'country', 'geo', 'location', 'zone', 'state'])]
                if not geo_cols:
                    geo_cols = [c for c, dtype in zip(df.columns, df.dtypes) if dtype in (pl.Utf8, pl.Categorical)]
                for g_col in geo_cols:
                    if g_col in df.columns:
                        unique_vals = df[g_col].unique().to_list()
                        if region_val in unique_vals or any(str(v).lower() == region_val.lower() for v in unique_vals if v is not None):
                            df = df.filter(pl.col(g_col).cast(pl.Utf8).str.to_lowercase() == region_val.lower())
                            break

            # 2. Selected Category filter
            cat_val = payload.selectedCategory
            if cat_val:
                cat_cols = [c for c, dtype in zip(df.columns, df.dtypes) if dtype in (pl.Utf8, pl.Categorical)]
                for c_col in cat_cols:
                    if c_col in df.columns:
                        unique_vals = df[c_col].unique().to_list()
                        if cat_val in unique_vals or any(str(v).lower() == cat_val.lower() for v in unique_vals if v is not None):
                            df = df.filter(pl.col(c_col).cast(pl.Utf8).str.to_lowercase() == cat_val.lower())
                            break

            # 3. Apply explicit filters
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

            # 4. Apply active_category_values filter map
            for col, values in payload.active_category_values.items():
                if col in df.columns and values:
                    df = df.filter(pl.col(col).is_in(values))

            # 5. Apply active_numeric_ranges filter map
            for col, r in payload.active_numeric_ranges.items():
                if col in df.columns and isinstance(r, (list, tuple)) and len(r) == 2:
                    df = df.filter((pl.col(col) >= r[0]) & (pl.col(col) <= r[1]))

            # 6. Apply date_range filter
            d_range = payload.date_range or payload.dateRange
            if d_range and 'start' in d_range and 'end' in d_range and d_range['start'] and d_range['end']:
                date_cols = [c for c in df.columns if 'date' in c.lower() or 'time' in c.lower()]
                if date_cols:
                    d_col = date_cols[0]
                    df = df.filter((pl.col(d_col) >= d_range['start']) & (pl.col(d_col) <= d_range['end']))

            # 7. Apply brushedRange filter
            if payload.brushedRange and len(payload.brushedRange) == 2:
                num_cols = [c for c, dtype in zip(df.columns, df.dtypes) if dtype in (pl.Float64, pl.Float32, pl.Int64, pl.Int32)]
                if num_cols:
                    df = df.filter((pl.col(num_cols[0]) >= payload.brushedRange[0]) & (pl.col(num_cols[0]) <= payload.brushedRange[1]))

            filtered_rows = len(df)

            # Column classification
            numeric_cols = [c for c, dtype in zip(df.columns, df.dtypes) if dtype in (pl.Float64, pl.Float32, pl.Int64, pl.Int32, pl.Int16, pl.Int8)]
            cat_cols = [c for c, dtype in zip(df.columns, df.dtypes) if dtype in (pl.Utf8, pl.Categorical, pl.Boolean)]
            date_cols = [c for c in df.columns if 'date' in c.lower() or 'time' in c.lower()]
            geo_cols = [c for c in df.columns if any(k in c.lower() for k in ['region', 'country', 'geo', 'location', 'zone', 'state'])]

            primary_metric = numeric_cols[0] if numeric_cols else "Value"

            kpis_summary = {
                "total_value": float(df[primary_metric].sum()) if filtered_rows > 0 and primary_metric in df.columns else 0.0,
                "total_records": filtered_rows,
                "growth_rate": 0.0,
                "unique_regions": int(df[geo_cols[0]].n_unique()) if filtered_rows > 0 and geo_cols and geo_cols[0] in df.columns else 1,
                "metric_name": primary_metric,
            }

            # Growth rate calculation if time column present
            if filtered_rows >= 2 and date_cols and primary_metric in df.columns:
                try:
                    sorted_df = df.sort(date_cols[0])
                    mid = filtered_rows // 2
                    h1 = sorted_df.slice(0, mid)[primary_metric].sum()
                    h2 = sorted_df.slice(mid)[primary_metric].sum()
                    if h1 and float(h1) != 0:
                        kpis_summary["growth_rate"] = round(((float(h2) - float(h1)) / float(h1)) * 100, 1)
                except Exception:
                    pass

            kpis = {}
            for col in numeric_cols:
                if filtered_rows > 0:
                    kpis[col] = {
                        "mean": float(df[col].mean()) if df[col].mean() is not None else 0.0,
                        "sum": float(df[col].sum()) if df[col].sum() is not None else 0.0,
                        "min": float(df[col].min()) if df[col].min() is not None else 0.0,
                        "max": float(df[col].max()) if df[col].max() is not None else 0.0,
                    }
                else:
                    kpis[col] = {"mean": 0.0, "sum": 0.0, "min": 0.0, "max": 0.0}

            categorical_breakdowns = {}
            for col in cat_cols[:4]:
                if filtered_rows > 0:
                    counts = df.group_by(col).len().sort("len", descending=True).head(10)
                    categorical_breakdowns[col] = counts.to_dicts()

            geo_data = []
            if geo_cols and geo_cols[0] in df.columns and filtered_rows > 0 and primary_metric in df.columns:
                g_df = df.group_by(geo_cols[0]).agg([
                    pl.col(primary_metric).sum().alias("value"),
                    pl.len().alias("count")
                ]).sort("value", descending=True)
                for r in g_df.to_dicts():
                    geo_data.append({
                        "region": str(r[geo_cols[0]]),
                        "value": float(r["value"]) if r["value"] is not None else 0.0,
                        "count": int(r["count"])
                    })

            correlations_dict = None
            if filtered_rows >= 3 and len(numeric_cols) >= 2:
                col_profiles = DatasetProfiler._build_column_profiles(df, filtered_rows)
                corr_matrix_obj = DatasetProfiler._build_correlation_matrix(df, col_profiles)
                if corr_matrix_obj:
                    correlations_dict = {
                        "columns": corr_matrix_obj.columns,
                        "matrix": corr_matrix_obj.matrix
                    }

            trends = []
            if date_cols and date_cols[0] in df.columns and filtered_rows > 0 and primary_metric in df.columns:
                t_df = df.group_by(date_cols[0]).agg(pl.col(primary_metric).sum().alias("value")).sort(date_cols[0])
                for r in t_df.to_dicts():
                    trends.append({
                        "date": str(r[date_cols[0]]),
                        "value": float(r["value"]) if r["value"] is not None else 0.0
                    })

            return {
                "success": True,
                "total_records": filtered_rows,
                "kpis": kpis_summary,
                "numeric_kpis": kpis,
                "categorical_breakdowns": categorical_breakdowns,
                "geoData": geo_data,
                "correlations": correlations_dict,
                "trends": trends,
            }
        except Exception as e:
            logger.error(f"Dashboard aggregation failure: {e}")
            return {
                "success": False,
                "error": str(e),
                "total_records": 0,
                "kpis": {},
                "numeric_kpis": {},
                "categorical_breakdowns": {},
                "geoData": [],
                "correlations": None,
                "trends": []
            }
