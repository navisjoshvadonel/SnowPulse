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
