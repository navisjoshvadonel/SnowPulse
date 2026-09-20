"""Tests for backend.app.ai.routes — AI endpoints."""

import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "testsecretkeytestsecretkeytestsecretkey")
os.environ.setdefault("JWT_REFRESH_SECRET_KEY", "testrefreshsecretkeytestrefreshsecretkey")
os.environ.setdefault("ENV", "testing")

from unittest.mock import AsyncMock, patch

from backend.app.models import Dataset


class TestAIRoutes:
    def test_chat_dataset_not_found(self, client, auth_headers):
        resp = client.post("/api/ai/chat", json={"query": "hello", "dataset_id": 99999}, headers=auth_headers)
        assert resp.status_code == 404
        assert resp.json()["detail"] == "Dataset not found"

    @patch("backend.app.ai.routes.vector_store.search_memory", new_callable=AsyncMock)
    @patch("backend.app.ai.routes.vector_store.add_memory", new_callable=AsyncMock)
    @patch("backend.app.ai.routes.run_supervisor_workflow")
    def test_chat_success_no_memories(self, mock_workflow, mock_add_memory, mock_search_memory, client, auth_headers):
        mock_search_memory.return_value = []

        async def mock_workflow_gen(*args, **kwargs):
            yield {"type": "reasoning", "data": "Thinking..."}
            yield {"type": "output", "data": "Hello world"}

        mock_workflow.side_effect = mock_workflow_gen

        resp = client.post("/api/ai/chat", json={"query": "hello"}, headers=auth_headers)
        assert resp.status_code == 200
        assert "text/event-stream" in resp.headers["content-type"]
        body = resp.text
        assert '{"type": "reasoning", "content": "Thinking..."}' in body
        assert '{"type": "token", "content": "Hello world"}' in body
        mock_add_memory.assert_called_once()

    @patch("backend.app.ai.routes.vector_store.search_memory", new_callable=AsyncMock)
    @patch("backend.app.ai.routes.vector_store.add_memory", new_callable=AsyncMock)
    @patch("backend.app.ai.routes.run_supervisor_workflow")
    def test_chat_success_with_memories_and_dataset(
        self, mock_workflow, mock_add_memory, mock_search_memory, client, db, test_user, auth_headers
    ):
        ds = Dataset(owner_id=test_user.id, name="chat-ds", file_path="/tmp/chat.csv")
        db.add(ds)
        db.commit()
        db.refresh(ds)

        mock_search_memory.return_value = [{"content": "Previous question context"}]

        async def mock_workflow_gen(*args, **kwargs):
            yield {"type": "reasoning", "data": "Processing context..."}
            yield {"type": "output", "data": "Answer with memory"}

        mock_workflow.side_effect = mock_workflow_gen

        resp = client.post("/api/ai/chat", json={"query": "hello", "dataset_id": ds.id}, headers=auth_headers)
        assert resp.status_code == 200
        body = resp.text
        assert 'Retrieved historical context from vector memory.' in body
        assert 'Answer with memory' in body
        mock_add_memory.assert_called_once()

    @patch("backend.app.ai.routes.vector_store.search_memory", new_callable=AsyncMock)
    @patch("backend.app.ai.routes.run_supervisor_workflow")
    def test_chat_sse_exception_handling(self, mock_workflow, mock_search_memory, client, auth_headers):
        mock_search_memory.return_value = []

        async def mock_workflow_gen(*args, **kwargs):
            raise ValueError("LLM execution error")
            yield  # unreachable yield to make it an async generator

        mock_workflow.side_effect = mock_workflow_gen

        resp = client.post("/api/ai/chat", json={"query": "hello"}, headers=auth_headers)
        assert resp.status_code == 200
        body = resp.text
        assert '{"type": "error", "content": "Execution failed: LLM execution error"}' in body

    def test_analyze_dataset_not_found(self, client, auth_headers):
        resp = client.post("/api/ai/analyze", json={"dataset_id": 99999}, headers=auth_headers)
        assert resp.status_code == 404

    @patch("backend.app.ai.routes.DatabaseTools.get_dataset_statistics")
    def test_analyze_dataset_success(self, mock_stats, client, db, test_user, auth_headers):
        mock_stats.return_value = {"success": True, "kpis": {}}

        ds = Dataset(owner_id=test_user.id, name="analyze-test", file_path="test.csv")
        db.add(ds)
        db.commit()
        db.refresh(ds)

        resp = client.post("/api/ai/analyze", json={"dataset_id": ds.id}, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["success"] is True

    @patch("backend.app.ai.routes.DatabaseTools.get_dataset_statistics")
    def test_analyze_dataset_failure(self, mock_stats, client, db, test_user, auth_headers):
        mock_stats.return_value = {"success": False, "error": "Failed to parse CSV"}

        ds = Dataset(owner_id=test_user.id, name="analyze-fail", file_path="bad.csv")
        db.add(ds)
        db.commit()
        db.refresh(ds)

        resp = client.post("/api/ai/analyze", json={"dataset_id": ds.id}, headers=auth_headers)
        assert resp.status_code == 400
        assert resp.json()["detail"] == "Failed to parse CSV"

    @patch("backend.app.ai.routes.ollama_client.generate", new_callable=AsyncMock)
    @patch("backend.app.ai.routes.ReportGenerator.generate_and_upload_report", new_callable=AsyncMock)
    @patch("backend.app.ai.routes.vector_store.add_memory", new_callable=AsyncMock)
    @patch("backend.app.ai.routes.DatabaseTools.get_dataset_statistics")
    def test_report_success(
        self, mock_stats, mock_add_memory, mock_report_gen, mock_generate, client, db, test_user, auth_headers
    ):
        ds = Dataset(owner_id=test_user.id, name="report-ds", file_path="report.csv")
        db.add(ds)
        db.commit()
        db.refresh(ds)

        mock_stats.return_value = {"success": True, "kpis": {"total": 100}}
        mock_generate.return_value = "# Executive Report Summary"
        mock_report_gen.return_value = ("reports/1/rep.pdf", "https://minio/reports/1/rep.pdf")

        resp = client.post(
            "/api/ai/report",
            json={"query": "Generate summary", "report_type": "executive", "dataset_id": ds.id},
            headers=auth_headers
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["report_type"] == "executive"
        assert data["object_path"] == "reports/1/rep.pdf"
        assert data["presigned_url"] == "https://minio/reports/1/rep.pdf"
        assert data["markdown_preview"] == "# Executive Report Summary"
        mock_add_memory.assert_called_once()

    @patch("backend.app.ai.routes.ollama_client.generate", new_callable=AsyncMock)
    @patch("backend.app.ai.routes.ReportGenerator.generate_and_upload_report", new_callable=AsyncMock)
    def test_report_failure(self, mock_report_gen, mock_generate, client, auth_headers):
        mock_generate.return_value = "# Report"
        mock_report_gen.side_effect = RuntimeError("MinIO upload failed")

        resp = client.post(
            "/api/ai/report",
            json={"query": "Generate report", "report_type": "kpi"},
            headers=auth_headers
        )

        assert resp.status_code == 500
        assert "Failed to generate report PDF: MinIO upload failed" in resp.json()["detail"]

    def test_forecast_dataset_not_found(self, client, auth_headers):
        resp = client.post("/api/ai/forecast", json={"dataset_id": 99999}, headers=auth_headers)
        assert resp.status_code == 404

    @patch("backend.app.ai.routes.DatabaseTools.get_forecast_scenarios")
    def test_forecast_dataset_success(self, mock_scenarios, client, db, test_user, auth_headers):
        mock_scenarios.return_value = {"success": True, "forecast_points": []}

        ds = Dataset(owner_id=test_user.id, name="forecast-test", file_path="test.csv")
        db.add(ds)
        db.commit()
        db.refresh(ds)

        resp = client.post("/api/ai/forecast", json={"dataset_id": ds.id}, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["success"] is True

    @patch("backend.app.ai.routes.DatabaseTools.get_forecast_scenarios")
    def test_forecast_dataset_failure(self, mock_scenarios, client, db, test_user, auth_headers):
        mock_scenarios.return_value = {"success": False, "error": "Insufficient time series data"}

        ds = Dataset(owner_id=test_user.id, name="forecast-fail", file_path="short.csv")
        db.add(ds)
        db.commit()
        db.refresh(ds)

        resp = client.post("/api/ai/forecast", json={"dataset_id": ds.id}, headers=auth_headers)
        assert resp.status_code == 400
        assert resp.json()["detail"] == "Insufficient time series data"

    @patch("backend.app.ai.routes.ollama_client.get_available_models")
    def test_models_endpoint(self, mock_get_models, client, auth_headers):
        mock_get_models.return_value = ["llama2", "qwen2.5"]
        resp = client.get("/api/ai/models", headers=auth_headers)
        assert resp.status_code == 200
        assert "models" in resp.json()

    @patch("backend.app.ai.routes.ollama_client.check_health")
    def test_health_endpoint(self, mock_health, client, auth_headers):
        mock_health.return_value = {"status": "healthy"}
        resp = client.get("/api/ai/health", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["status"] == "healthy"

    @patch("backend.app.ai.routes.ollama_client.check_health")
    def test_health_endpoint_degraded(self, mock_health, client, auth_headers):
        mock_health.return_value = {"status": "degraded"}
        resp = client.get("/api/ai/health", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["status"] == "degraded"

    @patch("backend.app.ai.routes.ollama_client.check_health")
    def test_health_endpoint_vector_error(self, mock_health, client, db, auth_headers):
        mock_health.return_value = {"status": "healthy"}
        orig_query = db.query

        def side_effect(model, *args, **kwargs):
            if getattr(model, "__name__", "") == "SemanticMemory":
                raise Exception("DB Error")
            return orig_query(model, *args, **kwargs)

        with patch.object(db, "query", side_effect=side_effect):
            resp = client.get("/api/ai/health", headers=auth_headers)
            assert resp.status_code == 200
            data = resp.json()
            assert data["status"] == "degraded"
            assert data["vector_memory"]["connected"] is False

    @patch("backend.app.ai.routes.AIEvaluator.run_full_evaluation_suite", new_callable=AsyncMock)
    def test_eval_endpoint(self, mock_eval, client, auth_headers):
        mock_eval.return_value = {"score": 95, "status": "passed"}
        resp = client.get("/api/ai/eval", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json() == {"score": 95, "status": "passed"}
