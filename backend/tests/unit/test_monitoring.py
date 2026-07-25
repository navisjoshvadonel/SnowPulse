"""Tests for backend.app.monitoring — MetricsManager, TracingManager, AlertingManager, health checks."""

import os
import time

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "testsecretkeytestsecretkeytestsecretkey")
os.environ.setdefault("JWT_REFRESH_SECRET_KEY", "testrefreshsecretkeytestrefreshsecretkey")
os.environ.setdefault("ENV", "testing")

from unittest.mock import MagicMock, patch

import pytest

from backend.app.monitoring import (
    AlertingManager,
    MetricsManager,
    TracingManager,
    alerter,
    get_metrics_response,
    metrics,
    run_liveness_check,
    run_readiness_check,
    tracer,
)


# --- MetricsManager ---

class TestMetricsManager:
    def test_counter_inc_api_requests(self):
        m = MetricsManager()
        # Should not raise
        m.counter_inc("api_requests", {"method": "GET", "endpoint": "/test", "status_code": "200"})

    def test_counter_inc_errors(self):
        m = MetricsManager()
        m.counter_inc("errors", {"type": "ValueError", "component": "auth"})

    def test_counter_inc_jobs(self):
        m = MetricsManager()
        m.counter_inc("jobs", {"task_name": "test_task", "status": "success"})

    def test_counter_inc_cache(self):
        m = MetricsManager()
        m.counter_inc("cache", {"action": "get", "status": "hit"})

    def test_counter_inc_unknown_metric_no_crash(self):
        m = MetricsManager()
        m.counter_inc("unknown_metric", {"foo": "bar"})

    def test_counter_inc_no_labels(self):
        m = MetricsManager()
        m.counter_inc("api_requests")

    def test_gauge_set_db_connections(self):
        m = MetricsManager()
        m.gauge_set("db_connections", 5.0)

    def test_gauge_set_ml_accuracy(self):
        m = MetricsManager()
        m.gauge_set("ml_accuracy", 0.95, {"task_type": "classification", "metric_name": "accuracy"})

    def test_gauge_set_unknown_no_crash(self):
        m = MetricsManager()
        m.gauge_set("unknown_gauge", 1.0)

    def test_histogram_observe_api_latency(self):
        m = MetricsManager()
        m.histogram_observe("api_latency", 0.15, {"method": "POST", "endpoint": "/api/test"})

    def test_histogram_observe_job_latency(self):
        m = MetricsManager()
        m.histogram_observe("job_latency", 2.5, {"task_name": "pipeline"})

    def test_histogram_observe_search_latency(self):
        m = MetricsManager()
        m.histogram_observe("search_latency", 0.03)

    def test_histogram_observe_unknown_no_crash(self):
        m = MetricsManager()
        m.histogram_observe("unknown_hist", 1.0)


# --- TracingManager ---

class TestTracingManager:
    def test_trace_span_decorator(self):
        t = TracingManager()

        @t.trace_span("test_operation")
        def my_function(x):
            return x * 2

        result = my_function(5)
        assert result == 10

    def test_trace_span_propagates_exception(self):
        t = TracingManager()

        @t.trace_span("failing_operation")
        def my_failing_function():
            raise ValueError("boom")

        with pytest.raises(ValueError, match="boom"):
            my_failing_function()


# --- AlertingManager ---

class TestAlertingManager:
    def test_trigger_alert(self):
        a = AlertingManager()
        # Should log but not raise
        a.trigger_alert("Test Alert", "Something went wrong", level="WARNING")


# --- Health checks ---

def test_run_liveness_check():
    result = run_liveness_check()
    assert result["status"] == "healthy"
    assert "timestamp" in result


def test_run_readiness_check_with_healthy_db():
    """When DB is working, overall status should be healthy."""
    mock_session_factory = MagicMock()
    mock_session = MagicMock()
    mock_session_factory.return_value = mock_session

    result = run_readiness_check(mock_session_factory)
    assert "status" in result
    assert "components" in result
    assert result["components"]["database"] == "healthy"


def test_run_readiness_check_with_broken_db():
    """When DB raises, status should reflect unhealthy."""
    def bad_session_factory():
        raise RuntimeError("DB connection failed")

    result = run_readiness_check(bad_session_factory)
    assert "unhealthy" in result["components"]["database"]
    assert result["status"] == "unhealthy"


# --- Metrics exporter ---

def test_get_metrics_response():
    response = get_metrics_response()
    assert response.status_code == 200
    assert "text/plain" in response.media_type


# --- Global instances ---

def test_global_instances_exist():
    assert isinstance(metrics, MetricsManager)
    assert isinstance(tracer, TracingManager)
    assert isinstance(alerter, AlertingManager)
