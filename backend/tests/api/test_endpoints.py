"""Extended API tests covering registration, refresh, logout, dashboards CRUD,
dataset delete, user/me, metrics, insights, and more main.py endpoints."""

import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "testsecretkeytestsecretkeytestsecretkey")
os.environ.setdefault("JWT_REFRESH_SECRET_KEY", "testrefreshsecretkeytestrefreshsecretkey")
os.environ.setdefault("ENV", "testing")


from backend.app.models import Dataset, Insight

# --- Registration ---

class TestRegistration:
    def test_register_success(self, client):
        resp = client.post("/api/auth/register", json={
            "email": "newuser@snowpulse.com",
            "password": "securePass123!"
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["email"] == "newuser@snowpulse.com"
        assert data["is_active"] is True

    def test_register_duplicate_email(self, client, test_user):
        resp = client.post("/api/auth/register", json={
            "email": test_user.email,
            "password": "password123"
        })
        assert resp.status_code == 400
        assert "already exists" in resp.json()["detail"]

    def test_register_invalid_email(self, client):
        resp = client.post("/api/auth/register", json={
            "email": "not-an-email",
            "password": "password123"
        })
        assert resp.status_code == 422


# --- Logout ---

class TestLogout:
    def test_logout_without_cookie(self, client):
        resp = client.post("/api/auth/logout")
        assert resp.status_code == 200
        assert resp.json()["detail"] == "Logged out successfully"

    def test_logout_with_login_cookie(self, client, test_user):
        # Login first to get refresh cookie
        login_resp = client.post(
            "/api/auth/login",
            data={"username": test_user.email, "password": "password123"}
        )
        assert login_resp.status_code == 200

        # Now logout
        resp = client.post("/api/auth/logout")
        assert resp.status_code == 200


# --- User/Me ---

class TestUserMe:
    def test_get_me_success(self, client, auth_headers, test_user):
        resp = client.get("/api/user/me", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == test_user.email

    def test_get_me_unauthorized(self, client):
        resp = client.get("/api/user/me")
        assert resp.status_code == 401


# --- Datasets ---

class TestDatasets:
    def test_get_datasets_empty(self, client, auth_headers):
        resp = client.get("/api/datasets", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json() == []

    def test_get_datasets_with_data(self, client, db, test_user, auth_headers):
        ds = Dataset(
            owner_id=test_user.id,
            name="sales",
            file_path="test_sales_data.csv"
        )
        db.add(ds)
        db.commit()

        resp = client.get("/api/datasets", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        assert any(d["name"] == "sales" for d in data)

    def test_delete_dataset_success(self, client, db, test_user, auth_headers):
        ds = Dataset(
            owner_id=test_user.id,
            name="to-delete",
            file_path="test_sales_data.csv"
        )
        db.add(ds)
        db.commit()
        db.refresh(ds)

        resp = client.delete(f"/api/datasets/{ds.id}", headers=auth_headers)
        assert resp.status_code == 204

    def test_delete_nonexistent_dataset(self, client, auth_headers):
        resp = client.delete("/api/datasets/99999", headers=auth_headers)
        assert resp.status_code == 404

    def test_get_datasets_unauthorized(self, client):
        resp = client.get("/api/datasets")
        assert resp.status_code == 401


# --- Dashboards ---

class TestDashboards:
    def test_create_dashboard(self, client, db, test_user, auth_headers):
        ds = Dataset(
            owner_id=test_user.id,
            name="test",
            file_path="test_sales_data.csv"
        )
        db.add(ds)
        db.commit()
        db.refresh(ds)

        resp = client.post("/api/dashboards", json={
            "title": "New Dashboard",
            "dataset_id": ds.id,
        }, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "New Dashboard"
        assert data["dataset_id"] == ds.id

    def test_create_dashboard_nonexistent_dataset(self, client, auth_headers):
        resp = client.post("/api/dashboards", json={
            "title": "Bad Dashboard",
            "dataset_id": 99999,
        }, headers=auth_headers)
        assert resp.status_code == 404


# --- Prometheus Metrics ---

class TestMetricsEndpoint:
    def test_metrics_endpoint(self, client):
        resp = client.get("/metrics")
        assert resp.status_code == 200
        assert "snowpulse" in resp.text or "HELP" in resp.text


# --- Insights ---

class TestInsights:
    def test_get_dataset_insights_empty(self, client, db, test_user, auth_headers):
        ds = Dataset(
            owner_id=test_user.id,
            name="insights-test",
            file_path="test_sales_data.csv"
        )
        db.add(ds)
        db.commit()
        db.refresh(ds)

        resp = client.get(f"/api/insights/dataset/{ds.id}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json() == []

    def test_get_dataset_insights_with_data(self, client, db, test_user, auth_headers):
        ds = Dataset(
            owner_id=test_user.id,
            name="insights-test2",
            file_path="test_sales_data.csv"
        )
        db.add(ds)
        db.commit()
        db.refresh(ds)

        insight = Insight(
            dataset_id=ds.id,
            title="Test Insight",
            description="A test insight",
            severity="Medium",
            score=50,
            category="Growth"
        )
        db.add(insight)
        db.commit()

        resp = client.get(f"/api/insights/dataset/{ds.id}", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        assert data[0]["title"] == "Test Insight"

    def test_get_insights_for_nonexistent_dataset(self, client, auth_headers):
        resp = client.get("/api/insights/dataset/99999", headers=auth_headers)
        assert resp.status_code == 404

    def test_trigger_insights_generation_nonexistent(self, client, auth_headers):
        resp = client.post("/api/insights/trigger/99999", headers=auth_headers)
        assert resp.status_code == 404

    def test_trigger_insights_generation_success(self, client, db, test_user, auth_headers, monkeypatch):
        from backend.app.jobs.manager import JobManager

        async def dummy_submit_job(task_name: str, *args, **kwargs):
            return "dummy-job-id-123"

        monkeypatch.setattr(JobManager, "submit_job", dummy_submit_job)

        ds = Dataset(
            owner_id=test_user.id,
            name="insights-trigger-test",
            file_path="test_sales_data.csv"
        )
        db.add(ds)
        db.commit()
        db.refresh(ds)

        resp = client.post(f"/api/insights/trigger/{ds.id}", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["job_id"] == "dummy-job-id-123"
        assert data["status"] == "queued"


# --- ML History ---

class TestMLHistory:
    def test_ml_history_nonexistent_dataset(self, client, auth_headers):
        resp = client.get("/api/ml/history/99999?task_type=classification", headers=auth_headers)
        assert resp.status_code == 404


# --- Upload Dataset validation ---

class TestUploadValidation:
    def test_upload_unsupported_extension(self, client, auth_headers):
        from io import BytesIO
        file = BytesIO(b"not a csv")
        resp = client.post(
            "/api/datasets/upload",
            files={"file": ("report.pdf", file, "application/pdf")},
            headers=auth_headers,
        )
        assert resp.status_code == 400
        assert "Only CSV and Excel" in resp.json()["detail"]


class TestAdditionalMainEndpoints:
    def test_health_endpoints(self, client):
        res1 = client.get("/health/liveness")
        assert res1.status_code == 200
        res2 = client.get("/health/readiness")
        assert res2.status_code in (200, 503)

    def test_audit_logs(self, client, auth_headers):
        res = client.get("/api/audit-logs", headers=auth_headers)
        assert res.status_code == 200

    def test_lineage(self, client, auth_headers):
        res = client.get("/api/analytics/lineage/1", headers=auth_headers)
        assert res.status_code == 200
        assert res.json()["dataset_id"] == 1

    def test_export_report(self, client, auth_headers):
        res = client.post("/api/analytics/export-report", json={"dataset_name": "test.csv"}, headers=auth_headers)
        assert res.status_code == 200
        assert res.json()["status"] == "success"

    def test_jobs_list_and_status_not_found(self, client, auth_headers):
        res1 = client.get("/api/jobs", headers=auth_headers)
        assert res1.status_code == 200
        res2 = client.get("/api/jobs/nonexistent-job-id", headers=auth_headers)
        assert res2.status_code == 200
        assert res2.json()["status"] in ("not_found", "unknown")

    def test_forecast_predict_nonexistent(self, client, auth_headers):
        res = client.get("/api/forecast/predict/99999", headers=auth_headers)
        assert res.status_code == 404

    def test_ml_targets_nonexistent(self, client, auth_headers):
        res = client.get("/api/ml/targets/99999", headers=auth_headers)
        assert res.status_code == 404

    def test_forecast_train_nonexistent(self, client, auth_headers):
        res = client.post("/api/forecast/train/99999?target_col=sales", headers=auth_headers)
        assert res.status_code == 404

    def test_analytics_summary_nonexistent(self, client, auth_headers):
        res = client.get("/api/analytics/summary/99999", headers=auth_headers)
        assert res.status_code == 404

    def test_analytics_insights_nonexistent(self, client, auth_headers):
        res = client.get("/api/analytics/insights/99999", headers=auth_headers)
        assert res.status_code == 404

    def test_dataset_suggestions_nonexistent(self, client, auth_headers):
        res = client.get("/api/datasets/99999/suggestions", headers=auth_headers)
        assert res.status_code == 404

    def test_dataset_signals_nonexistent(self, client, auth_headers):
        res = client.get("/api/datasets/99999/signals", headers=auth_headers)
        assert res.status_code == 404


class TestDatasetAnalyticsEndpoints:
    def test_dataset_analytics_flow(self, client, db, test_user, auth_headers, tmp_path):
        csv_file = tmp_path / "test.csv"
        csv_file.write_text("date,region,category,sales\n2025-01-01,North,Electronics,100\n2025-01-02,South,Books,200\n2025-01-03,North,Books,150\n")

        ds = Dataset(
            owner_id=test_user.id,
            name="analytics-flow-test",
            file_path=str(csv_file)
        )
        db.add(ds)
        db.commit()
        db.refresh(ds)

        # Profile
        res = client.get(f"/api/datasets/{ds.id}/profile", headers=auth_headers)
        assert res.status_code == 200

        # Reprofile
        res = client.post(f"/api/datasets/{ds.id}/reprofile", headers=auth_headers)
        assert res.status_code == 200

        # Schema
        res = client.get(f"/api/datasets/{ds.id}/schema", headers=auth_headers)
        assert res.status_code == 200

        # Decomposition Tree
        res = client.get(f"/api/datasets/{ds.id}/decomposition-tree", headers=auth_headers)
        assert res.status_code == 200

        # Monte Carlo
        res = client.get(f"/api/datasets/{ds.id}/monte-carlo", headers=auth_headers)
        assert res.status_code == 200

        # Calculated Fields
        res = client.post(f"/api/datasets/{ds.id}/calculated-fields", json={"prompt": "rolling average of sales"}, headers=auth_headers)
        assert res.status_code == 200

        # Geo Spatial
        res = client.get(f"/api/datasets/{ds.id}/geo-spatial", headers=auth_headers)
        assert res.status_code == 200

        # Query
        res = client.post(f"/api/datasets/{ds.id}/query", json={"metrics": [{"column": "sales", "agg": "sum"}]}, headers=auth_headers)
        assert res.status_code == 200

        # Dashboard Aggregate
        res = client.post(f"/api/datasets/{ds.id}/aggregate", json={}, headers=auth_headers)
        assert res.status_code == 200

        # Analytics Summary
        res = client.get(f"/api/analytics/summary/{ds.id}", headers=auth_headers)
        assert res.status_code == 200

        # Analytics Insights
        res = client.get(f"/api/analytics/insights/{ds.id}", headers=auth_headers)
        assert res.status_code == 200

        # Suggestions
        res = client.get(f"/api/datasets/{ds.id}/suggestions", headers=auth_headers)
        assert res.status_code in (200, 500)

        # Signals
        res = client.get(f"/api/datasets/{ds.id}/signals", headers=auth_headers)
        assert res.status_code == 200

        # Usage
        res = client.get("/api/analytics/usage", headers=auth_headers)
        assert res.status_code == 200

        # Search
        res = client.get("/api/search?q=sales", headers=auth_headers)
        assert res.status_code == 200

        # Storage Presigned
        res = client.get("/api/storage/presigned/datasets/test.csv", headers=auth_headers)
        assert res.status_code in (200, 500)

        # ML targets
        res = client.get(f"/api/ml/targets/{ds.id}", headers=auth_headers)
        assert res.status_code == 200

        # Forecast predict missing model
        res = client.get(f"/api/forecast/predict/{ds.id}", headers=auth_headers)
        assert res.status_code == 400
