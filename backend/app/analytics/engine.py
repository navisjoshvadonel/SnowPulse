import os
from typing import Any

import numpy as np
import polars as pl


class AnalyticsEngine:
    def __init__(self, file_path: str):
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Dataset file not found at {file_path}")
        self.file_path = file_path
        self.df = pl.read_csv(file_path)
        self.headers = self.df.columns
        self.num_rows = self.df.height

        # Detect and classify columns
        self.numeric_cols = []
        self.date_cols = []
        self.categorical_cols = []
        self.geo_cols = []

        self._classify_columns()
        self._determine_semantic_mappings()

    def _classify_columns(self):
        for col in self.headers:
            dtype = self.df.schema[col]
            col_lower = col.lower()

            # Simple keyword matching for geography
            is_geo = any(k in col_lower for k in ["region", "country", "city", "state", "geo", "location"])

            if dtype in [pl.Int8, pl.Int16, pl.Int32, pl.Int64, pl.Float32, pl.Float64]:
                if is_geo:
                    self.geo_cols.append(col)
                else:
                    self.numeric_cols.append(col)
            elif dtype == pl.Date or dtype == pl.Datetime:
                self.date_cols.append(col)
            else:
                # String/categorical columns
                # Try parsing as date
                sample = self.df[col].head(100).drop_nulls()
                date_parsed = False
                if len(sample) > 0:
                    try:
                        # Test if it parses as datetime
                        parsed = pl.Series(sample).str.to_datetime(strict=False)
                        if parsed.null_count() < len(sample) * 0.5:
                            self.date_cols.append(col)
                            date_parsed = True
                    except Exception:
                        pass

                if not date_parsed:
                    if is_geo:
                        self.geo_cols.append(col)
                    else:
                        self.categorical_cols.append(col)

    def _determine_semantic_mappings(self):
        # Establish primary target metric
        self.metric_col = None
        for col in self.numeric_cols:
            col_lower = col.lower()
            if any(k in col_lower for k in ["revenue", "sales", "amount", "price", "total", "value"]):
                self.metric_col = col
                break
        if not self.metric_col and self.numeric_cols:
            self.metric_col = self.numeric_cols[0]

        # Establish primary date column
        self.date_col = None
        for col in self.date_cols:
            col_lower = col.lower()
            if any(k in col_lower for k in ["date", "time", "timestamp", "year", "month"]):
                self.date_col = col
                break
        if not self.date_col and self.date_cols:
            self.date_col = self.date_cols[0]

        # Establish primary category column
        self.category_col = None
        for col in self.categorical_cols:
            col_lower = col.lower()
            if any(k in col_lower for k in ["category", "segment", "type", "class", "group", "product"]):
                self.category_col = col
                break
        if not self.category_col and self.categorical_cols:
            self.category_col = self.categorical_cols[0]

        # Establish primary geographic column
        self.geo_col = self.geo_cols[0] if self.geo_cols else None
        if not self.category_col and self.geo_col:
            self.category_col = self.geo_col

    def get_kpis(self) -> dict[str, Any]:
        """
        Computes the primary Executive KPIs.
        """
        if not self.metric_col:
            return {"error": "No numeric metric column found"}

        # Total metric value (e.g. Total Revenue)
        total_value = float(self.df[self.metric_col].sum())

        # Mean, Median, StdDev
        mean_value = float(self.df[self.metric_col].mean() or 0)
        std_dev = float(self.df[self.metric_col].std() or 0)

        # Calculate Growth Rate (Period-over-Period comparing second half vs first half)
        growth_rate = 0.0
        if self.df.height > 1:
            half = self.df.height // 2
            first_half_sum = float(self.df.head(half)[self.metric_col].sum() or 0)
            second_half_sum = float(self.df.tail(self.df.height - half)[self.metric_col].sum() or 0)
            if first_half_sum > 0:
                growth_rate = ((second_half_sum - first_half_sum) / first_half_sum) * 100

        # Total unique segments/categories if column exists
        unique_segments = 0
        if self.category_col:
            unique_segments = self.df[self.category_col].n_unique()

        # Total unique regions if geo column exists
        unique_regions = 0
        if self.geo_col:
            unique_regions = self.df[self.geo_col].n_unique()

        # Build a statistical confidence/data quality score
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
            "quality_score": quality_score
        }

    def get_trends(self) -> dict[str, Any]:
        """
        Groups the primary metric by date to produce charts for ECharts.
        """
        if not self.metric_col:
            return {"error": "No numeric metric column found"}

        df_sorted = self.df

        # If we have a date column, parse and group by it
        if self.date_col:
            # Try to convert date column to Date object if it's currently String
            if self.df.schema[self.date_col] == pl.Utf8:
                df_sorted = self.df.with_columns(
                    pl.col(self.date_col).str.to_datetime(strict=False).alias("_parsed_date")
                )
            else:
                df_sorted = self.df.with_columns(
                    pl.col(self.date_col).alias("_parsed_date")
                )

            # Sort by date
            df_sorted = df_sorted.sort("_parsed_date")

            # Aggregate by date
            grouped = df_sorted.group_by("_parsed_date").agg(
                pl.col(self.metric_col).sum().alias("value")
            ).sort("_parsed_date")

            # Extract lists
            dates = [str(d) for d in grouped["_parsed_date"].to_list()]
            values = grouped["value"].to_list()
        else:
            # Fallback to row index as trend if no date column
            dates = [f"Period {i+1}" for i in range(self.df.height)]
            values = self.df[self.metric_col].to_list()

        # Compute simple moving average (rolling window) for trend smoothing
        values_np = np.array(values, dtype=float)
        window = max(2, len(values_np) // 5)
        sma = np.convolve(values_np, np.ones(window)/window, mode='same').tolist()

        return {
            "metric": self.metric_col,
            "dates": dates,
            "values": values,
            "moving_average": sma
        }

    def get_geo_metrics(self) -> list[dict[str, Any]]:
        """
        Computes regional distributions of the primary metric.
        """
        active_geo_col = self.geo_col or self.category_col
        if not active_geo_col or not self.metric_col:
            return []

        # Group by regional column and sum primary metric
        grouped = self.df.group_by(active_geo_col).agg([
            pl.col(self.metric_col).sum().alias("value"),
            pl.count().alias("count")
        ]).sort("value", descending=True)

        result = []
        for row in grouped.iter_rows():
            result.append({
                "region": row[0],
                "value": float(row[1] or 0),
                "count": int(row[2] or 0)
            })
        return result

    def get_anomalies(self) -> list[dict[str, Any]]:
        """
        Flags statistical outliers using rolling or global Z-scores and IQR boundaries.
        """
        if not self.metric_col:
            return []

        vals = self.df[self.metric_col].to_numpy().astype(float)
        if len(vals) < 3:
            return []

        mean = np.mean(vals)
        std = np.std(vals) or 1.0

        # IQR boundary limits
        q75, q25 = np.percentile(vals, [75 ,25])
        iqr = q75 - q25
        lower_bound = q25 - 1.5 * iqr
        upper_bound = q75 + 1.5 * iqr

        anomalies = []
        for i in range(len(vals)):
            val = vals[i]
            z_score = (val - mean) / std
            is_outlier = (abs(z_score) > 2.0) or (val < lower_bound or val > upper_bound)

            if is_outlier:
                severity = "Low"
                if abs(z_score) >= 3.0:
                    severity = "Critical"
                elif abs(z_score) >= 2.4:
                    severity = "High"
                elif abs(z_score) >= 1.8:
                    severity = "Medium"

                date_str = str(self.df.row(i)[self.headers.index(self.date_col)]) if self.date_col else f"Row {i+1}"
                category_str = str(self.df.row(i)[self.headers.index(self.category_col)]) if self.category_col else "General"
                region_str = str(self.df.row(i)[self.headers.index(self.geo_col)]) if self.geo_col else "Global"

                anomalies.append({
                    "row_index": i + 1,
                    "date": date_str,
                    "category": category_str,
                    "region": region_str,
                    "value": float(val),
                    "z_score": float(z_score),
                    "deviation_pct": float(((val - mean) / (mean or 1.0)) * 100),
                    "severity": severity
                })
        return anomalies

    def get_correlations(self) -> dict[str, Any]:
        """
        Calculates Pearson correlation matrix for all numeric columns.
        """
        all_numeric = self.numeric_cols + ([self.metric_col] if self.metric_col not in self.numeric_cols else [])
        all_numeric = [c for c in all_numeric if c in self.headers]

        if len(all_numeric) < 2:
            return {"columns": all_numeric, "matrix": [[1.0]]}

        sub_df = self.df.select(all_numeric).drop_nulls()
        if sub_df.height < 3:
            return {"columns": all_numeric, "matrix": [[1.0] * len(all_numeric)] * len(all_numeric)}

        matrix = []
        for col_a in all_numeric:
            row_corrs = []
            for col_b in all_numeric:
                corr = np.corrcoef(sub_df[col_a].to_numpy(), sub_df[col_b].to_numpy())[0, 1]
                # Replace nan with 0.0
                if np.isnan(corr):
                    corr = 0.0
                row_corrs.append(float(corr))
            matrix.append(row_corrs)

        return {
            "columns": all_numeric,
            "matrix": matrix
        }

    def generate_statistical_context_summary(self) -> str:
        """
        Generates a text summary of the statistics to feed as prompt context for Gemini.
        """
        kpis = self.get_kpis()
        self.get_trends()
        geo = self.get_geo_metrics()
        anomalies = self.get_anomalies()

        summary = []
        summary.append(f"Dataset summary of file: {os.path.basename(self.file_path)}")
        summary.append(f"Primary target metric: {self.metric_col}")
        summary.append(f"Total rows: {self.num_rows}")
        summary.append(f"Total aggregate value: {kpis.get('total_value'):,.2f}")
        summary.append(f"Mean value: {kpis.get('mean_value'):,.2f}")
        summary.append(f"Growth Rate (Period-over-Period): {kpis.get('growth_rate'):.1f}%")

        if self.category_col:
            summary.append(f"Grouping categories found in column: '{self.category_col}'")
        if self.geo_col:
            summary.append(f"Geography categories found in column: '{self.geo_col}'")

        if geo:
            top_geo = geo[0]
            summary.append(f"Top performing region/segment: '{top_geo.get('region')}' with value {top_geo.get('value'):,.2f} ({top_geo.get('count')} records)")

        summary.append(f"Statistical anomalies/outliers detected: {len(anomalies)}")
        for idx, anom in enumerate(anomalies[:5]):
            summary.append(f" - Outlier {idx+1}: Row {anom['row_index']} at Date {anom['date']}, Category {anom['category']}, Region {anom['region']} with value {anom['value']:,.2f} (Z-Score: {anom['z_score']:.2f})")

        return "\n".join(summary)
