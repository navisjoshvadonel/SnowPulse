"""Tests for backend.app.ai.routes — AI endpoints."""

import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "testsecretkeytestsecretkeytestsecretkey")
os.environ.setdefault("JWT_REFRESH_SECRET_KEY", "testrefreshsecretkeytestrefreshsecretkey")
os.environ.setdefault("ENV", "testing")

from unittest.mock import patch

import pytest

from backend.app.models import Dataset


class TestAIRoutes:
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
