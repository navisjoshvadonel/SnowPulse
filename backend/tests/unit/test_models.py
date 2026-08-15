"""Tests for backend.app.models — ORM model definitions and relationships."""

import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "testsecretkeytestsecretkeytestsecretkey")
os.environ.setdefault("JWT_REFRESH_SECRET_KEY", "testrefreshsecretkeytestrefreshsecretkey")
os.environ.setdefault("ENV", "testing")

import datetime

from backend.app.auth import get_password_hash
from backend.app.models import Dataset, Insight, RefreshToken, User, UserDashboard


class TestUserModel:
    def test_create_user(self, db):
        user = User(
            email="model_test@example.com",
            hashed_password=get_password_hash("pw"),
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        assert user.id is not None
        assert user.email == "model_test@example.com"
        assert user.is_active is True
        assert user.failed_attempts == 0
        assert user.locked_until is None

    def test_user_cascade_deletes_dashboards(self, db):
        user = User(
            email="cascade_test@example.com",
            hashed_password=get_password_hash("pw"),
        )
        db.add(user)
        db.commit()

        ds = Dataset(owner_id=user.id, name="test", file_path="x.csv")
        db.add(ds)
        db.commit()

        dashboard = UserDashboard(
            user_id=user.id, dataset_id=ds.id, title="will-be-deleted"
        )
        db.add(dashboard)
        db.commit()
        dashboard_id = dashboard.id

        db.delete(user)
        db.commit()

        assert db.query(UserDashboard).filter(UserDashboard.id == dashboard_id).first() is None


class TestDatasetModel:
    def test_create_dataset(self, db, test_user):
        ds = Dataset(
            owner_id=test_user.id,
            name="TestDS",
            description="A test dataset",
            file_path="/data/test.csv",
        )
        db.add(ds)
        db.commit()
        db.refresh(ds)

        assert ds.id is not None
        assert ds.name == "TestDS"
        assert ds.owner_id == test_user.id


class TestInsightModel:
    def test_create_insight(self, db, test_user):
        ds = Dataset(owner_id=test_user.id, name="ins-ds", file_path="x.csv")
        db.add(ds)
        db.commit()
        db.refresh(ds)

        insight = Insight(
            dataset_id=ds.id,
            title="Test Insight",
            description="Something interesting",
            severity="Medium",
            score=65,
            category="Growth",
        )
        db.add(insight)
        db.commit()
        db.refresh(insight)

        assert insight.id is not None
        assert insight.severity == "Medium"
        assert insight.recommendation is None


class TestRefreshTokenModel:
    def test_create_refresh_token(self, db, test_user):
        rt = RefreshToken(
            token="test-token-value",
            user_id=test_user.id,
            expires_at=datetime.datetime.utcnow() + datetime.timedelta(days=7),
        )
        db.add(rt)
        db.commit()
        db.refresh(rt)

        assert rt.id is not None
        assert rt.revoked is False
        assert rt.user_id == test_user.id
