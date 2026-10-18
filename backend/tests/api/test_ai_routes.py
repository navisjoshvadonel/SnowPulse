"""Tests for backend.app.ai.routes — AI endpoints."""

import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "testsecretkeytestsecretkeytestsecretkey")
os.environ.setdefault("JWT_REFRESH_SECRET_KEY", "testrefreshsecretkeytestrefreshsecretkey")
os.environ.setdefault("ENV", "testing")

from unittest.mock import patch

from backend.app.models import Dataset


class TestAIRoutes:
    def test_analyze_dataset_not_found(self, client, auth_headers):
        resp = client.post("/api/ai/analyze", json={"dataset_id": 99999}, headers=auth_headers)
        assert resp.status_code == 404

    def test_ai_endpoints_unauthorized_dataset_access(self, client, db, test_user, auth_headers):
        from backend.app.auth import get_password_hash
        from backend.app.models import User

        # Create a second user
        other_user = User(email="user2@example.com", hashed_password=get_password_hash("password123"))
        db.add(other_user)
        db.commit()
        db.refresh(other_user)

        # Create dataset owned by user2
        other_ds = Dataset(owner_id=other_user.id, name="other-user-ds", file_path="other.csv")
        db.add(other_ds)
        db.commit()
        db.refresh(other_ds)

        # Assert user 1 gets 404 when querying another tenant's dataset across AI endpoints
        resp_analyze = client.post("/api/ai/analyze", json={"dataset_id": other_ds.id}, headers=auth_headers)
        assert resp_analyze.status_code == 404

        resp_forecast = client.post("/api/ai/forecast", json={"dataset_id": other_ds.id}, headers=auth_headers)
        assert resp_forecast.status_code == 404

        resp_report = client.post("/api/ai/report", json={"query": "test", "report_type": "kpi", "dataset_id": other_ds.id}, headers=auth_headers)
        assert resp_report.status_code == 404

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
