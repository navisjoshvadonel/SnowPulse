"""Tests for backend.app.ai.graphs.supervisor — LangGraph supervisor and node execution."""

import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "testsecretkeytestsecretkeytestsecretkey")
os.environ.setdefault("JWT_REFRESH_SECRET_KEY", "testrefreshsecretkeytestrefreshsecretkey")
os.environ.setdefault("ENV", "testing")

from unittest.mock import patch

import pytest

from backend.app.ai.graphs.supervisor import AIState, create_supervisor_graph


class TestSupervisorGraph:
    @patch("backend.app.ai.graphs.supervisor.ollama_client.generate")
    @pytest.mark.asyncio
    async def test_supervisor_routing(self, mock_generate):
        mock_generate.return_value = '{"next_agent": "kpi_agent", "reasoning": "Analyzing metrics"}'

        graph = create_supervisor_graph()
        assert graph is not None

    @patch("backend.app.ai.graphs.supervisor.DatabaseTools.get_dataset_statistics")
    @patch("backend.app.ai.graphs.supervisor.ollama_client.generate")
    @pytest.mark.asyncio
    async def test_data_analyst_node(self, mock_generate, mock_stats):
        from backend.app.ai.graphs.supervisor import data_analyst_node

        mock_stats.return_value = {"success": True, "kpis": {"total_sales": 1000}, "summary_context": "Test data"}
        mock_generate.return_value = "This is a detailed analysis."

        state: AIState = {
            "query": "Analyze the sales",
            "messages": [],
            "next_agent": "supervisor",
            "agent_outputs": {},
            "context": {"dataset_path": "test.csv"},
            "citations": [],
            "reasoning_steps": [],
            "final_response": None
        }

        new_state = await data_analyst_node(state)
        assert "kpi_agent" in new_state["agent_outputs"]
        assert "This is a detailed analysis" in new_state["agent_outputs"]["kpi_agent"]

    @patch("backend.app.ai.graphs.supervisor.DatabaseTools.get_data_quality_report")
    @patch("backend.app.ai.graphs.supervisor.ollama_client.generate")
    @pytest.mark.asyncio
    async def test_quality_auditor_node(self, mock_generate, mock_quality):
        from backend.app.ai.graphs.supervisor import quality_auditor_node

        mock_quality.return_value = {"success": True, "quality_score": 95}
        mock_generate.return_value = "Data quality is excellent."

        state: AIState = {
            "query": "Check quality",
            "messages": [],
            "next_agent": "supervisor",
            "agent_outputs": {},
            "context": {"dataset_path": "test.csv"},
            "citations": [],
            "reasoning_steps": [],
            "final_response": None
        }

        new_state = await quality_auditor_node(state)
        assert "dataset_agent" in new_state["agent_outputs"]
        assert "Data quality is excellent" in new_state["agent_outputs"]["dataset_agent"]

    @patch("backend.app.ai.graphs.supervisor.DatabaseTools.get_forecast_scenarios")
    @patch("backend.app.ai.graphs.supervisor.ollama_client.generate")
    @pytest.mark.asyncio
    async def test_forecaster_node(self, mock_generate, mock_forecast):
        from backend.app.ai.graphs.supervisor import forecaster_node

        mock_forecast.return_value = {"success": True, "forecast_points": []}
        mock_generate.return_value = "Forecast is stable."

        state: AIState = {
            "query": "Give me a forecast",
            "messages": [],
            "next_agent": "supervisor",
            "agent_outputs": {},
            "context": {"dataset_id": 1},
            "citations": [],
            "reasoning_steps": [],
            "final_response": None
        }

        new_state = await forecaster_node(state)
        assert "forecast_agent" in new_state["agent_outputs"]
        assert "Forecast is stable" in new_state["agent_outputs"]["forecast_agent"]

