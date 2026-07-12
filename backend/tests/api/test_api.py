from backend.app.auth import get_password_hash
from backend.app.models import Dataset, User, UserDashboard


def test_health_endpoints(client):
    # Liveness check
    response = client.get("/health/liveness")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

    # Readiness check
    response = client.get("/health/readiness")
    assert response.status_code == 200
    assert "status" in response.json()

def test_login_invalid_credentials(client):
    response = client.post(
        "/api/auth/login",
        data={"username": "wrong@email.com", "password": "password"}
    )
    assert response.status_code == 401
    assert "Incorrect email or password" in response.json()["detail"]

def test_login_success(client, db, test_user):
    response = client.post(
        "/api/auth/login",
        data={"username": test_user.email, "password": "password123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert "refresh_token" in client.cookies

def test_dashboard_tenant_isolation(client, db, test_user, auth_headers):
    # Create another user and a dashboard belonging to them
    other_user = User(
        email="other@snowpulse.com",
        hashed_password=get_password_hash("password123"),
        is_active=True
    )
    db.add(other_user)
    db.commit()
    db.refresh(other_user)

    # Create dataset
    dataset = Dataset(
        owner_id=test_user.id,
        name="test_sales_data.csv",
        file_path="test_sales_data.csv"
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)

    # Dashboard for other user
    other_dashboard = UserDashboard(
        user_id=other_user.id,
        dataset_id=dataset.id,
        title="Other's Dashboard",
        insight_notes="Private"
    )
    db.add(other_dashboard)

    # Dashboard for test user
    my_dashboard = UserDashboard(
        user_id=test_user.id,
        dataset_id=dataset.id,
        title="My Dashboard",
        insight_notes="Mine"
    )
    db.add(my_dashboard)
    db.commit()

    # 1. Fetch dashboards for test user. Should NOT contain other's dashboard
    response = client.get("/api/dashboards", headers=auth_headers)
    assert response.status_code == 200
    dashboards = response.json()
    assert len(dashboards) == 1
    assert dashboards[0]["title"] == "My Dashboard"

    # 2. Get single dashboard belonging to other user. Should be unauthorized/404
    response = client.get(f"/api/dashboards/{other_dashboard.id}", headers=auth_headers)
    assert response.status_code == 404

def test_analytics_summary_with_real_csv(client, db, test_user, auth_headers):
    # Register dataset in DB pointing to real local test_sales_data.csv
    dataset = Dataset(
        owner_id=test_user.id,
        name="test_sales_data.csv",
        file_path="test_sales_data.csv"
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)

    response = client.get(f"/api/analytics/summary/{dataset.id}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "kpis" in data
    assert "trends" in data
    assert "geo" in data
    assert "anomalies" in data
    assert "correlations" in data

def test_gdpr_forget_me(client, db, test_user, auth_headers):
    # Create dataset and dashboard for test_user
    dataset = Dataset(
        owner_id=test_user.id,
        name="test_sales_data.csv",
        file_path="test_sales_data.csv"
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)

    dashboard = UserDashboard(
        user_id=test_user.id,
        dataset_id=dataset.id,
        title="To Be Forgotten",
        insight_notes="Temp"
    )
    db.add(dashboard)
    db.commit()

    # Run forget-me GDPR purge
    response = client.delete("/api/user/account", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["status"] == "success"

    # Check that user, dashboard are removed (cascade deletes)
    purged_user = db.query(User).filter(User.id == test_user.id).first()
    assert purged_user is None

    purged_dashboard = db.query(UserDashboard).filter(UserDashboard.id == dashboard.id).first()
    assert purged_dashboard is None


def test_dataset_schema(client, db, test_user, auth_headers):
    dataset = Dataset(
        owner_id=test_user.id,
        name="test_sales_data.csv",
        file_path="test_sales_data.csv"
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)

    response = client.get(f"/api/datasets/{dataset.id}/schema", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["dataset_id"] == dataset.id
    assert data["name"] == dataset.name
    assert "row_count" in data
    assert "column_count" in data
    assert "columns" in data
    assert len(data["columns"]) > 0
    for col in data["columns"]:
        assert "name" in col
        assert "null_count" in col
        assert "role" in col

    # Unauthorized/not found check
    response = client.get("/api/datasets/9999/schema", headers=auth_headers)
    assert response.status_code == 404


def test_ml_training_history_empty(client, db, test_user, auth_headers):
    dataset = Dataset(
        owner_id=test_user.id,
        name="test_sales_data.csv",
        file_path="test_sales_data.csv"
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)

    response = client.get(f"/api/ml/history/{dataset.id}?task_type=forecasting", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["dataset_id"] == dataset.id
    assert data["task_type"] == "forecasting"
    assert data["runs"] == []

    # Unauthorized/not found check
    response = client.get(f"/api/ml/history/9999?task_type=forecasting", headers=auth_headers)
    assert response.status_code == 404

