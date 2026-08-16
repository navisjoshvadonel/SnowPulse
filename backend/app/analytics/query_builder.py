import logging
from typing import Any

import polars as pl
from pydantic import BaseModel

from .engine import _load_df

logger = logging.getLogger("snowpulse.analytics.query_builder")

class QueryFilter(BaseModel):
    column: str
    op: str  # e.g., '==', '!=', '>', '<', '>=', '<=', 'in'
    value: Any

class QueryMetric(BaseModel):
    column: str
    agg: str  # 'sum', 'avg', 'count', 'min', 'max'

class QueryPayload(BaseModel):
    dimensions: list[str] = []
    metrics: list[QueryMetric] = []
    filters: list[QueryFilter] = []
    sort_by: str | None = None
    sort_desc: bool = True
    limit: int = 100

class DynamicQueryEngine:
    @staticmethod
    def execute_query(file_path: str, query: QueryPayload) -> dict[str, Any]:
        """
        Takes a JSON payload describing filters, dimensions, and aggregations,
        and translates it into highly optimized Polars dataframe operations.
        """
        try:
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
