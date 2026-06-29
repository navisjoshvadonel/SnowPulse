import io
import pandas as pd
import numpy as np
import logging
from typing import Any, Dict, List, Tuple
import pandera as pa
from ..schemas.dataset_schema import sales_transaction_schema, get_dynamic_schema

logger = logging.getLogger("snowpulse.validation.quality")

class DataQualityScorer:
    """
    Validates uploaded files (CSV or Excel) and calculates a comprehensive quality score.
    """
    
    @staticmethod
    def read_file_to_pandas(file_bytes: bytes, filename: str) -> pd.DataFrame:
        """
        Parses binary file contents into a Pandas DataFrame. Supports CSV and Excel.
        """
        ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
        try:
            if ext == 'xlsx' or ext == 'xls':
                return pd.read_excel(io.BytesIO(file_bytes))
            else:
                # Default to CSV. Auto-detect separators or encoding if needed
                try:
                    return pd.read_csv(io.BytesIO(file_bytes))
                except UnicodeDecodeError:
                    return pd.read_csv(io.BytesIO(file_bytes), encoding="latin-1")
        except Exception as e:
            logger.error(f"Error reading file {filename}: {e}")
            raise ValueError(f"Failed to parse file: {str(e)}")

    @classmethod
    def validate_and_score(cls, file_bytes: bytes, filename: str) -> Tuple[bool, Dict[str, Any]]:
        """
        Performs Pandera schema checks, gathers validation errors, and computes data health score.
        """
        try:
            df = cls.read_file_to_pandas(file_bytes, filename)
        except Exception as e:
            return False, {
                "error": f"Invalid file format: {str(e)}",
                "quality_score": 0.0,
                "anomalies": [{"row": 0, "column": "file", "error": "Unable to read spreadsheet"}]
            }

        if len(df) == 0:
            return False, {
                "error": "Dataset is empty",
                "quality_score": 0.0,
                "anomalies": [{"row": 0, "column": "all", "error": "Zero records found"}]
            }

        # 1. Select schema: Use strict sales schema if columns match, else use dynamic schema
        required_sales_cols = {"Date", "Revenue"}
        if required_sales_cols.issubset(df.columns):
            schema = sales_transaction_schema
            schema_type = "strict_sales"
        else:
            schema = get_dynamic_schema(df)
            schema_type = "dynamic_inferred"

        anomalies: List[Dict[str, Any]] = []
        is_valid = True

        # 2. Execute Pandera Validation
        try:
            schema.validate(df, lazy=True)
        except pa.errors.SchemaErrors as err:
            is_valid = False
            # Parse lazy validation errors
            for failure in err.schema_errors:
                col = failure.schema.name if failure.schema else "unknown"
                reason = str(failure.reason)
                row_idx = failure.failure_cases.get("index") if failure.failure_cases is not None else None
                val = failure.failure_cases.get("failure_case") if failure.failure_cases is not None else None
                
                # If row_idx is a list or Series, make it a list
                rows = []
                if row_idx is not None:
                    if isinstance(row_idx, (pd.Series, np.ndarray, list)):
                        rows = [int(x) for x in row_idx]
                    else:
                        rows = [int(row_idx)]
                else:
                    rows = [-1]

                for r in rows[:10]: # Limit to first 10 failure rows per schema constraint to avoid flooding
                    anomalies.append({
                        "row": r + 1 if r >= 0 else None,
                        "column": col,
                        "error": f"Constraint failed: {reason}",
                        "value": str(val) if val is not None else None
                    })

        # 3. Calculate Quality Metrics
        total_cells = df.size
        null_cells = df.isnull().sum().sum()
        null_ratio = null_cells / total_cells if total_cells > 0 else 0.0
        
        # Deduct score for null cells (max 30 points deduction)
        null_deduction = min(30, int(null_ratio * 100))
        
        # Deduct score for validation anomalies (max 40 points deduction)
        # Weight each unique anomaly type
        anomaly_deduction = min(40, len(anomalies) * 2)

        # Deduct score for format complexity (e.g. duplicate columns)
        dup_cols = len(df.columns) - len(set(df.columns))
        dup_deduction = min(10, dup_cols * 5)

        quality_score = max(10, 100 - null_deduction - anomaly_deduction - dup_deduction)

        # 4. Outlier detection to flag additional quality notices
        # Check numeric columns for outliers (> 3 std dev)
        outlier_count = 0
        for col in df.select_dtypes(include=[np.number]).columns:
            col_data = df[col].dropna()
            if len(col_data) > 3:
                std = col_data.std()
                mean = col_data.mean()
                if std > 0:
                    outliers = col_data[abs(col_data - mean) / std > 3.0]
                    outlier_count += len(outliers)
                    for idx in outliers.index[:5]:
                        anomalies.append({
                            "row": int(idx) + 1,
                            "column": col,
                            "error": f"Statistical outlier flagged (> 3 std dev)",
                            "value": float(df.loc[idx, col])
                        })

        return is_valid, {
            "schema_type": schema_type,
            "quality_score": int(quality_score),
            "total_records": len(df),
            "columns": list(df.columns),
            "missing_values_count": int(null_cells),
            "missing_values_pct": float(null_ratio * 100),
            "outliers_count": outlier_count,
            "anomalies": anomalies
        }
