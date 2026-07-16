import os
import re
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from ...analytics.engine import AnalyticsEngine
from ...forecasting.predictor import ForecastingPredictor
from ...logging_config import logger
from ...search.service import search_service
from ...validation.quality.quality_scorer import DataQualityScorer

# Regex to detect write commands in SQL string
FORBIDDEN_SQL_KEYWORDS = re.compile(
    r"\b(insert|update|delete|drop|alter|create|truncate|replace|grant|revoke|schema|rename|merge|upsert)\b",
    re.IGNORECASE
)

# Regex to detect queries targeting sensitive database tables
SENSITIVE_TABLES = re.compile(
    r"\b(users|refresh_tokens|user_dashboards|semantic_memory)\b",
    re.IGNORECASE
)

class SecurityAlertException(Exception):
    pass

def sanitize_and_validate_sql(sql_query: str) -> str:
    """
    Validates that a query is read-only and free of SQL-injection/modification attempts.
    """
    clean_query = sql_query.strip()

    # Remove SQL comments to inspect actual query text
    clean_query = re.sub(r"--.*?(?:\n|$)", "", clean_query)
    clean_query = re.sub(r"/\*.*?\*/", "", clean_query, flags=re.DOTALL)
    clean_query = clean_query.strip()

    # Must start with SELECT (ignoring case)
    if not clean_query.lower().startswith("select"):
        raise SecurityAlertException("Access Denied: SQL command must start with 'SELECT'. Only read-only operations are permitted.")

    # Check for forbidden keywords
    if FORBIDDEN_SQL_KEYWORDS.search(clean_query):
        raise SecurityAlertException("Access Denied: Destructive operations or database modifications detected in query.")

    # Check for queries targeting sensitive system tables
    if SENSITIVE_TABLES.search(clean_query):
        raise SecurityAlertException("Access Denied: Querying sensitive system tables (users, tokens, dashboards, memory) is forbidden.")

    return clean_query


class DatabaseTools:
    @staticmethod
    def execute_read_only_sql(db: Session, sql_query: str) -> dict[str, Any]:
        """
        Executes a validated read-only SQL query on the database and returns columns and row arrays.
        """
        try:
            validated_query = sanitize_and_validate_sql(sql_query)

            # Enforce database query limits if query doesn't specify one
            if "limit" not in validated_query.lower():
                # Strip trailing semicolon if present
                if validated_query.endswith(";"):
                    validated_query = validated_query[:-1]
                validated_query += " LIMIT 100"

            result = db.execute(text(validated_query))
            columns = list(result.keys())
            rows = [list(row) for row in result.all()]

            # Audit logging of query execution
            logger.info("sql.execution", query=validated_query, rows_returned=len(rows), status="success")

            return {
                "success": True,
                "columns": columns,
                "rows": rows,
                "count": len(rows)
            }
        except SecurityAlertException as sae:
            logger.warning("security.sql_violation", query=sql_query, alert=str(sae))
            return {
                "success": False,
                "error": str(sae),
                "security_alert": True
            }
        except Exception as e:
            logger.error("sql.execution_error", query=sql_query, error=str(e))
            return {
                "success": False,
                "error": f"SQL execution error: {str(e)}"
            }

    @staticmethod
    def search_resources(query: str, limit: int = 5) -> list[dict[str, Any]]:
        """
        Queries Meilisearch to locate matching dashboard charts, datasets, and insights.
        """
        try:
            res = search_service.search(query=query, limit=limit)
            return res.get("hits", [])
        except Exception as e:
            logger.error("search_resources_tool_error", query=query, error=str(e))
            return []

    @staticmethod
    def get_dataset_statistics(dataset_path: str) -> dict[str, Any]:
        """
        Loads dataset using AnalyticsEngine (Polars) and retrieves general statistics context.
        """
        try:
            engine = AnalyticsEngine(dataset_path)
            kpis = engine.get_kpis()
            correlations = engine.get_correlations()
            anomalies = engine.get_anomalies()
            summary = engine.generate_statistical_context_summary()

            return {
                "success": True,
                "kpis": kpis,
                "correlations": correlations,
                "anomalies_count": len(anomalies),
                "summary_context": summary
            }
        except Exception as e:
            logger.error("get_dataset_statistics_error", path=dataset_path, error=str(e))
            return {"success": False, "error": str(e)}

    @staticmethod
    def get_forecast_scenarios(dataset_id: int, steps: int = 30) -> dict[str, Any]:
        """
        Runs statsmodels prediction model and builds optimistic/pessimistic comparison ranges.
        """
        try:
            predictor = ForecastingPredictor(dataset_id=dataset_id)
            if not predictor.loaded:
                return {
                    "success": False,
                    "error": "No forecasting models trained for this dataset yet."
                }

            predictions = predictor.predict(steps=steps)
            points = predictions.get("forecast", [])

            # Scenario math comparison
            baseline = sum(pt["prediction"] for pt in points)
            optimistic = sum(pt["upper"] for pt in points)
            pessimistic = sum(pt["lower"] for pt in points)

            return {
                "success": True,
                "model_used": predictions.get("model", "auto"),
                "forecast_points": points,
                "scenarios": {
                    "baseline_cumulative": baseline,
                    "optimistic_cumulative": optimistic,
                    "pessimistic_cumulative": pessimistic,
                    "growth_rate_estimate": predictions.get("growth_rate", 0.0)
                }
            }
        except Exception as e:
            logger.error("get_forecast_scenarios_error", dataset_id=dataset_id, error=str(e))
            return {"success": False, "error": str(e)}

    @staticmethod
    def get_data_quality_report(file_path: str) -> dict[str, Any]:
        """
        Runs DataQualityScorer checks on file bytes to evaluate schema health and completeness.
        """
        try:
            if not os.path.exists(file_path):
                return {"success": False, "error": f"File not found: {file_path}"}

            with open(file_path, "rb") as f:
                content = f.read()

            is_valid, report = DataQualityScorer.validate_and_score(content, os.path.basename(file_path))
            return {
                "success": True,
                "is_valid": is_valid,
                "quality_score": report.get("quality_score", 100),
                "total_records": report.get("total_records", 0),
                "missing_values": report.get("missing_values_count", 0),
                "issues": report.get("anomalies_detected", [])
            }
        except Exception as e:
            logger.error("get_data_quality_report_error", path=file_path, error=str(e))
            return {"success": False, "error": str(e)}
