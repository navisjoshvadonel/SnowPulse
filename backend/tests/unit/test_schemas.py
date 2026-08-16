"""Tests for backend.app.schemas — Pydantic schema validation and serialization."""

import datetime
import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "testsecretkeytestsecretkeytestsecretkey")
os.environ.setdefault("JWT_REFRESH_SECRET_KEY", "testrefreshsecretkeytestrefreshsecretkey")
os.environ.setdefault("ENV", "testing")

import pytest
from pydantic import ValidationError

from backend.app.schemas import (
    DashboardCreate,
    DatasetCreate,
    DatasetResponse,
    InsightResponse,
    JobStatusResponse,
    JobSubmission,
    TokenResponse,
    UserCreate,
    UserResponse,
    UserUpdate,
)


class TestUserSchemas:
    def test_user_create_valid(self):
        u = UserCreate(email="test@example.com", password="password123")
        assert u.email == "test@example.com"
        assert u.password == "password123"

    def test_user_create_invalid_email(self):
        with pytest.raises(ValidationError):
            UserCreate(email="not-an-email", password="password123")

    def test_user_response(self):
        u = UserResponse(
            id=1,
            email="test@example.com",
            is_active=True,
            created_at=datetime.datetime.utcnow(),
        )
        assert u.id == 1
        assert u.is_active is True
        assert u.avatar_url is None

    def test_user_update(self):
        u = UserUpdate(avatar_url="https://example.com/avatar.png")
        assert u.avatar_url == "https://example.com/avatar.png"

    def test_user_update_defaults(self):
        u = UserUpdate()
        assert u.avatar_url is None


class TestDatasetSchemas:
    def test_dataset_create(self):
        d = DatasetCreate(name="Sales", file_path="/data/sales.csv")
        assert d.name == "Sales"
        assert d.description is None

    def test_dataset_response(self):
        d = DatasetResponse(
            id=1,
            name="Sales",
            file_path="/data/sales.csv",
            created_at=datetime.datetime.utcnow(),
        )
        assert d.id == 1
        assert d.job_id is None


class TestDashboardSchemas:
    def test_dashboard_create(self):
        d = DashboardCreate(title="My Dashboard", dataset_id=1)
        assert d.title == "My Dashboard"
        assert d.insight_notes is None
        assert d.query_history is None

    def test_dashboard_create_with_history(self):
        d = DashboardCreate(
            title="Dashboard",
            dataset_id=1,
            query_history=[{"q": "test"}],
        )
        assert len(d.query_history) == 1


class TestTokenResponse:
    def test_token_response(self):
        t = TokenResponse(access_token="abc123")
        assert t.access_token == "abc123"
        assert t.token_type == "bearer"


class TestInsightResponse:
    def test_insight_response(self):
        i = InsightResponse(
            id=1,
            dataset_id=1,
            title="Anomaly",
            description="High spike",
            severity="Critical",
            score=90,
            category="Anomaly",
            created_at=datetime.datetime.utcnow(),
        )
        assert i.severity == "Critical"
        assert i.recommendation is None


class TestJobSchemas:
    def test_job_submission(self):
        j = JobSubmission(task_name="pipeline_task")
        assert j.queue == "default"
        assert j.arguments is None

    def test_job_submission_with_args(self):
        j = JobSubmission(
            task_name="train",
            queue="ml",
            arguments={"epochs": 10},
        )
        assert j.arguments["epochs"] == 10

    def test_job_status_response(self):
        j = JobStatusResponse(
            job_id="abc-123",
            status="completed",
            progress=100,
            message="Done",
        )
        assert j.job_id == "abc-123"
        assert j.error is None
        assert j.result is None
