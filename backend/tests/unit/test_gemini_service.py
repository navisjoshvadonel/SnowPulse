"""Tests for backend.app.ai.gemini_service — fallback insights and copilot."""

import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "testsecretkeytestsecretkeytestsecretkey")
os.environ.setdefault("JWT_REFRESH_SECRET_KEY", "testrefreshsecretkeytestrefreshsecretkey")
os.environ.setdefault("ENV", "testing")

from unittest.mock import patch

from backend.app.ai.gemini_service import GeminiService


MOCK_STATS_CONTEXT = """Primary target metric: Revenue
Total rows: 100
Total aggregate value: 50,000.00
Growth rate (period-over-period): +12.5%
Top performing region/segment: North America
Statistical anomalies/outliers detected: 3"""


class TestGeminiFallbackInsights:
    """Test the offline rule-based insight generator (no API key required)."""

    def test_fallback_insights_structure(self):
        with patch.dict(os.environ, {"GEMINI_API_KEY": ""}, clear=False):
            service = GeminiService()
            assert service.active is False
            result = service.generate_dashboard_insights(MOCK_STATS_CONTEXT)

        assert "headline_insight" in result
        assert "trend_insight" in result
        assert "geo_insight" in result
        assert "recommendations" in result
        assert isinstance(result["recommendations"], list)
        assert len(result["recommendations"]) == 3

    def test_fallback_insights_contain_metric_name(self):
        with patch.dict(os.environ, {"GEMINI_API_KEY": ""}, clear=False):
            service = GeminiService()
            result = service._generate_fallback_insights(MOCK_STATS_CONTEXT)
        assert "Revenue" in result["headline_insight"]

    def test_fallback_insights_contain_geo(self):
        with patch.dict(os.environ, {"GEMINI_API_KEY": ""}, clear=False):
            service = GeminiService()
            result = service._generate_fallback_insights(MOCK_STATS_CONTEXT)
        assert "North America" in result["geo_insight"]


class TestGeminiFallbackCopilot:
    """Test the offline copilot response branches."""

    def _get_service(self):
        with patch.dict(os.environ, {"GEMINI_API_KEY": ""}, clear=False):
            return GeminiService()

    def test_revenue_query(self):
        service = self._get_service()
        response = service._generate_fallback_copilot_response("What is total revenue?", MOCK_STATS_CONTEXT)
        assert "Revenue" in response
        assert "50,000" in response

    def test_forecast_query(self):
        service = self._get_service()
        response = service._generate_fallback_copilot_response("Can you predict next quarter?", MOCK_STATS_CONTEXT)
        assert "Forecast" in response

    def test_anomaly_query(self):
        service = self._get_service()
        response = service._generate_fallback_copilot_response("Show me anomaly details", MOCK_STATS_CONTEXT)
        assert "anomalies" in response.lower()

    def test_generic_query(self):
        service = self._get_service()
        response = service._generate_fallback_copilot_response("Tell me about the weather", MOCK_STATS_CONTEXT)
        assert "Primary Metric" in response

    def test_ask_copilot_offline(self):
        service = self._get_service()
        response = service.ask_copilot("What are sales?", MOCK_STATS_CONTEXT)
        assert len(response) > 0


class TestGeminiContextCaching:
    """Test context caching retrieval and token discount tracking."""

    def test_usage_summary_includes_cached_tokens(self):
        service = GeminiService()
        summary = service.get_usage_summary(1024 * 1024 * 5)
        assert "cached_tokens_saved" in summary
        assert summary["cached_tokens_saved"] >= 0

    def test_record_usage_counts_cached_content_tokens(self):
        service = GeminiService()
        initial_cached = service.cached_tokens_saved
        
        class MockUsageMetadata:
            total_token_count = 500
            cached_content_token_count = 350

        service.record_usage("test prompt", "test response", MockUsageMetadata())
        assert service.cached_tokens_saved == initial_cached + 350

    def test_context_cache_fallback_when_inactive(self):
        with patch.dict(os.environ, {"GEMINI_API_KEY": ""}, clear=False):
            service = GeminiService()
            model = service._get_or_create_context_cache(MOCK_STATS_CONTEXT)
            assert model is None

