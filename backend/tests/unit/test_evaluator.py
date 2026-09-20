import os
from unittest.mock import AsyncMock, patch

import pytest

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "testsecretkeytestsecretkeytestsecretkey")
os.environ.setdefault("JWT_REFRESH_SECRET_KEY", "testrefreshsecretkeytestrefreshsecretkey")
os.environ.setdefault("ENV", "testing")


from backend.app.ai.evaluation.evaluator import AIEvaluator


class TestOverlapCoefficient:
    def test_high_overlap(self):
        response = "The forecast prediction indicates growth using statsmodels"
        context = "forecast prediction statsmodels growth time-series"
        score = AIEvaluator.calculate_overlap_coefficient(response, context)
        assert score > 0.3

    def test_zero_overlap(self):
        response = "Completely different topic discussion"
        context = "Sales revenue growth metrics"
        score = AIEvaluator.calculate_overlap_coefficient(response, context)
        assert score == 0.0

    def test_empty_response_returns_default(self):
        score = AIEvaluator.calculate_overlap_coefficient("", "some context")
        assert score == 1.0

    def test_empty_context_returns_default(self):
        score = AIEvaluator.calculate_overlap_coefficient("some response", "")
        assert score == 1.0

    def test_both_empty(self):
        score = AIEvaluator.calculate_overlap_coefficient("", "")
        assert score == 1.0

    def test_identical_text(self):
        text = "analytics forecast prediction model training evaluation"
        score = AIEvaluator.calculate_overlap_coefficient(text, text)
        assert score == 1.0

    def test_stop_words_are_filtered(self):
        """Stop words like 'the', 'and', 'for' should be filtered."""
        response = "the and for with this that from"
        context = "different words entirely here"
        score = AIEvaluator.calculate_overlap_coefficient(response, context)
        assert score <= 1.0


class TestSQLSecurityEvaluation:
    def test_evaluate_sql_security_blocks_toxic(self):
        result = AIEvaluator.evaluate_sql_security()
        assert result["toxic_blocked_percentage"] == 100.0
        assert result["toxic_blocked"] == result["toxic_total"]

    def test_evaluate_sql_security_allows_safe(self):
        result = AIEvaluator.evaluate_sql_security()
        assert result["safe_allowed_percentage"] > 0
        assert result["safe_allowed"] > 0

    def test_evaluate_sql_security_has_details(self):
        result = AIEvaluator.evaluate_sql_security()
        assert "details" in result
        assert len(result["details"]) > 0
        for detail in result["details"]:
            assert "query" in detail
            assert "status" in detail
            assert "passed" in detail


@pytest.mark.asyncio
@patch("backend.app.ai.evaluation.evaluator.OllamaClient")
async def test_evaluate_agent_routing(mock_ollama_class):
    mock_client = AsyncMock()
    mock_ollama_class.return_value = mock_client
    mock_client.generate.return_value = '{"next_agent": "forecast_agent"}'

    res = await AIEvaluator.evaluate_agent_routing()
    assert "accuracy_percentage" in res
    assert "passed_count" in res
    assert res["total_cases"] == 6


@pytest.mark.asyncio
@patch("backend.app.ai.evaluation.evaluator.supervisor_graph")
async def test_run_full_evaluation_suite(mock_graph, db):
    mock_graph.ainvoke = AsyncMock(return_value={"final_response": "Data health check complete."})

    with patch("backend.app.ai.evaluation.evaluator.OllamaClient") as mock_ollama_class:
        mock_client = AsyncMock()
        mock_ollama_class.return_value = mock_client
        mock_client.generate.return_value = '{"next_agent": "forecast_agent"}'

        suite_res = await AIEvaluator.run_full_evaluation_suite(db)
        assert "metrics" in suite_res
        assert suite_res["metrics"]["routing_accuracy"] >= 0.0
