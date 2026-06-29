import time
from collections.abc import Callable
from functools import wraps
from typing import Any

from .logging_config import logger


class MetricsManager:
    """
    Interface for recording application metrics.
    Abstracts actual collection library (e.g. prometheus_client).
    """
    def __init__(self):
        self._metrics: dict[str, Any] = {}

    def counter_inc(self, name: str, labels: dict[str, str] = None):
        logger.info("monitoring.metrics.counter_inc", metric_name=name, labels=labels or {})

    def gauge_set(self, name: str, value: float, labels: dict[str, str] = None):
        logger.info("monitoring.metrics.gauge_set", metric_name=name, value=value, labels=labels or {})

    def histogram_observe(self, name: str, value: float, labels: dict[str, str] = None):
        logger.info("monitoring.metrics.histogram_observe", metric_name=name, value=value, labels=labels or {})

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
    Verify all dependent services (database, cache) are ready.
    """
    checks = {}

    # 1. Check Database
    try:
        db = db_session_factory()
        # Simple query
        db.execute("SELECT 1")
        checks["database"] = "healthy"
        db.close()
    except Exception as e:
        checks["database"] = f"unhealthy: {str(e)}"

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

    overall = "healthy" if all("healthy" in str(v) for v in checks.values()) else "unhealthy"

    return {
        "status": overall,
        "components": checks,
        "timestamp": time.time()
    }
