import time
from collections.abc import Callable
from functools import wraps
from typing import Any

from fastapi import Response
from prometheus_client import REGISTRY, Counter, Gauge, Histogram, generate_latest

from .logging_config import logger

# --- Prometheus Metrics Definitions ---
API_REQUEST_COUNT = Counter(
    "snowpulse_api_requests_total",
    "Total number of HTTP requests processed",
    ["method", "endpoint", "status_code"]
)

API_REQUEST_LATENCY = Histogram(
    "snowpulse_api_request_duration_seconds",
    "HTTP request latency in seconds",
    ["method", "endpoint"]
)

ERROR_RATE = Counter(
    "snowpulse_errors_total",
    "Total number of application errors and exceptions",
    ["type", "component"]
)

JOB_EXECUTION_COUNT = Counter(
    "snowpulse_job_executions_total",
    "Total number of background job executions",
    ["task_name", "status"]
)

JOB_EXECUTION_LATENCY = Histogram(
    "snowpulse_job_duration_seconds",
    "Background job execution time in seconds",
    ["task_name"]
)

DB_ACTIVE_CONNECTIONS = Gauge(
    "snowpulse_db_connections_active",
    "Number of active database connections"
)

CACHE_OPERATIONS = Counter(
    "snowpulse_cache_operations_total",
    "Total cache hits and misses",
    ["action", "status"]
)

SEARCH_LATENCY = Histogram(
    "snowpulse_search_duration_seconds",
    "Search execution latency in seconds"
)

FORECAST_COUNT = Counter(
    "snowpulse_forecasts_generated_total",
    "Total number of forecast outputs generated",
    ["model_type", "status"]
)

ML_PIPELINE_RUNS = Counter(
    "snowpulse_ml_pipeline_runs_total",
    "Total number of ML model training cycles",
    ["task_type", "status"]
)

ML_MODEL_ACCURACY = Gauge(
    "snowpulse_ml_model_metric",
    "Latest trained model metric score",
    ["task_type", "metric_name"]
)

class MetricsManager:
    """
    Interface for recording application metrics.
    Adapts direct metrics recording to Prometheus clients.
    """
    def __init__(self):
        self._metrics: dict[str, Any] = {}

    def counter_inc(self, name: str, labels: dict[str, str] | None = None):
        """
        Increment a prometheus counter.
        """
        logger.info("monitoring.metrics.counter_inc", metric_name=name, labels=labels or {})
        try:
            if name == "api_requests":
                API_REQUEST_COUNT.labels(
                    method=labels.get("method", "GET"),
                    endpoint=labels.get("endpoint", "/"),
                    status_code=labels.get("status_code", "200")
                ).inc()
            elif name == "errors":
                ERROR_RATE.labels(
                    type=labels.get("type", "generic"),
                    component=labels.get("component", "unknown")
                ).inc()
            elif name == "jobs":
                JOB_EXECUTION_COUNT.labels(
                    task_name=labels.get("task_name", "unknown"),
                    status=labels.get("status", "success")
                ).inc()
            elif name == "cache":
                CACHE_OPERATIONS.labels(
                    action=labels.get("action", "get"),
                    status=labels.get("status", "miss")
                ).inc()
        except Exception as e:
            logger.error(f"Failed to record counter '{name}': {e}")

    def gauge_set(self, name: str, value: float, labels: dict[str, str] | None = None):
        """
        Set a prometheus gauge value.
        """
        logger.info("monitoring.metrics.gauge_set", metric_name=name, value=value, labels=labels or {})
        try:
            if name == "db_connections":
                DB_ACTIVE_CONNECTIONS.set(value)
            elif name == "ml_accuracy":
                ML_MODEL_ACCURACY.labels(
                    task_type=labels.get("task_type", "unknown"),
                    metric_name=labels.get("metric_name", "score")
                ).set(value)
        except Exception as e:
            logger.error(f"Failed to record gauge '{name}': {e}")

    def histogram_observe(self, name: str, value: float, labels: dict[str, str] | None = None):
        """
        Observe a value in a prometheus histogram.
        """
        logger.info("monitoring.metrics.histogram_observe", metric_name=name, value=value, labels=labels or {})
        try:
            if name == "api_latency":
                API_REQUEST_LATENCY.labels(
                    method=labels.get("method", "GET"),
                    endpoint=labels.get("endpoint", "/")
                ).observe(value)
            elif name == "job_latency":
                JOB_EXECUTION_LATENCY.labels(
                    task_name=labels.get("task_name", "unknown")
                ).observe(value)
            elif name == "search_latency":
                SEARCH_LATENCY.observe(value)
        except Exception as e:
            logger.error(f"Failed to record histogram '{name}': {e}")

class TracingManager:
    """
    Interface for OpenTelemetry/APM distributed tracing context wrapper.
    """
    def trace_span(self, name: str):
        """
        Decorator/Context manager for tracing functions.
        """
        def decorator(func: Callable):
            @wraps(func)
            def wrapper(*args, **kwargs):
                start_time = time.time()
                logger.info("monitoring.trace.span_start", span_name=name)
                try:
                    result = func(*args, **kwargs)
                    logger.info("monitoring.trace.span_end", span_name=name, duration_ms=(time.time() - start_time) * 1000)
                    return result
                except Exception as e:
                    logger.error("monitoring.trace.span_error", span_name=name, error=str(e))
                    raise
            return wrapper
        return decorator

class AlertingManager:
    """
    Interface for sending critical notifications (e.g., to Slack, PagerDuty).
    """
    def trigger_alert(self, title: str, message: str, level: str = "ERROR"):
        logger.error("monitoring.alert.triggered", title=title, message=message, level=level)

# Instantiate global managers
metrics = MetricsManager()
tracer = TracingManager()
alerter = AlertingManager()

# Metrics Exporter Endpoint Handler
def get_metrics_response() -> Response:
    """
    FastAPI response handler for prometheus scrapers.
    """
    return Response(
        content=generate_latest(REGISTRY),
        media_type="text/plain; version=0.0.4; charset=utf-8"
    )

# Health system status checks
def run_liveness_check() -> dict[str, Any]:
    """
    Verify application is running. Minimal processing.
    """
    return {
        "status": "healthy",
        "timestamp": time.time()
    }

def run_readiness_check(db_session_factory: Callable) -> dict[str, Any]:
    """
    Verify all dependent services (database, cache, storage, search) are ready.
    """
    checks = {}

    # 1. Check Database
    try:
        db = db_session_factory()
        db.execute("SELECT 1")
        checks["database"] = "healthy"
        DB_ACTIVE_CONNECTIONS.set(1)
        db.close()
    except Exception as e:
        checks["database"] = f"unhealthy: {str(e)}"
        DB_ACTIVE_CONNECTIONS.set(0)

    # 2. Check Cache
    try:
        from .cache.cache_service import cache_service
        if cache_service.enabled and cache_service.client:
            cache_service.client.ping()
            checks["cache"] = "healthy"
        else:
            checks["cache"] = "degraded (running in offline fallback)"
    except Exception as e:
        checks["cache"] = f"unhealthy: {str(e)}"

    # 3. Check Storage (MinIO)
    try:
        from .storage.service import storage_service
        if storage_service.enabled and storage_service.client:
            # List buckets to verify connection
            storage_service.client.list_buckets()
            checks["storage"] = "healthy"
        else:
            checks["storage"] = "unhealthy (offline)"
    except Exception as e:
        checks["storage"] = f"unhealthy: {str(e)}"

    # 4. Check Search (Meilisearch)
    try:
        from .search.service import search_service
        if search_service.enabled and search_service.client:
            search_service.client.health()
            checks["search"] = "healthy"
        else:
            checks["search"] = "unhealthy (offline)"
    except Exception as e:
        checks["search"] = f"unhealthy: {str(e)}"

    overall = "healthy" if all("healthy" in str(v) for v in checks.values()) else "unhealthy"

    return {
        "status": overall,
        "components": checks,
        "timestamp": time.time()
    }
