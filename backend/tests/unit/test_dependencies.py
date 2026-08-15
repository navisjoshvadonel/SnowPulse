"""Tests for backend.app.dependencies — JWT-based user authentication and dashboard ownership."""

import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "testsecretkeytestsecretkeytestsecretkey")
os.environ.setdefault("JWT_REFRESH_SECRET_KEY", "testrefreshsecretkeytestrefreshsecretkey")
os.environ.setdefault("ENV", "testing")

import pytest
from fastapi import HTTPException

from backend.app.auth import create_access_token, create_refresh_token, get_password_hash
from backend.app.dependencies import get_current_user, verify_dashboard_ownership
from backend.app.models import Dataset, User, UserDashboard


class TestGetCurrentUser:
    """Tests for the get_current_user dependency."""

    def test_valid_access_token(self, db, test_user):
        """Valid access token resolves the correct user."""
        token = create_access_token(data={"sub": test_user.email})
        user = get_current_user(db=db, token=token)
        assert user.email == test_user.email

    def test_invalid_token_raises_401(self, db):
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(db=db, token="invalid.jwt.token")
        assert exc_info.value.status_code == 401

    def test_refresh_token_rejected(self, db, test_user):
        """Refresh tokens should NOT work as access tokens."""
        token = create_refresh_token(data={"sub": test_user.email})
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(db=db, token=token)
        assert exc_info.value.status_code == 401

    def test_nonexistent_user_raises_401(self, db):
        token = create_access_token(data={"sub": "ghost@nobody.com"})
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(db=db, token=token)
        assert exc_info.value.status_code == 401

    def test_inactive_user_raises_400(self, db):
        inactive = User(
            email="inactive@test.com",
            hashed_password=get_password_hash("pw"),
            is_active=False,
        )
        db.add(inactive)
        db.commit()
        db.refresh(inactive)

        token = create_access_token(data={"sub": inactive.email})
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(db=db, token=token)
        assert exc_info.value.status_code == 400

    def test_token_without_sub_raises_401(self, db):
        """Token payload missing 'sub' claim."""
        token = create_access_token(data={"role": "admin"})  # no 'sub'
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(db=db, token=token)
        assert exc_info.value.status_code == 401


class TestVerifyDashboardOwnership:
    """Tests for the verify_dashboard_ownership dependency."""

    def test_own_dashboard_returns_it(self, db, test_user):
        dataset = Dataset(
            owner_id=test_user.id,
            name="test.csv",
            file_path="test.csv",
        )
        db.add(dataset)
        db.commit()
        db.refresh(dataset)

        dashboard = UserDashboard(
            user_id=test_user.id,
            dataset_id=dataset.id,
            title="Mine",
        )
        db.add(dashboard)
        db.commit()
        db.refresh(dashboard)

        result = verify_dashboard_ownership(
            dashboard_id=dashboard.id,
            current_user=test_user,
            db=db,
        )
        assert result.id == dashboard.id
        assert result.title == "Mine"

    def test_other_users_dashboard_raises_404(self, db, test_user):
        other = User(
            email="other@test.com",
            hashed_password=get_password_hash("pw"),
            is_active=True,
        )
        db.add(other)
        db.commit()
        db.refresh(other)

        dataset = Dataset(
            owner_id=other.id,
            name="other.csv",
            file_path="other.csv",
        )
        db.add(dataset)
        db.commit()
        db.refresh(dataset)

        dashboard = UserDashboard(
            user_id=other.id,
            dataset_id=dataset.id,
            title="Not Mine",
        )
        db.add(dashboard)
        db.commit()
        db.refresh(dashboard)

        with pytest.raises(HTTPException) as exc_info:
            verify_dashboard_ownership(
                dashboard_id=dashboard.id,
                current_user=test_user,
                db=db,
            )
        assert exc_info.value.status_code == 404

    def test_nonexistent_dashboard_raises_404(self, db, test_user):
        with pytest.raises(HTTPException) as exc_info:
            verify_dashboard_ownership(
                dashboard_id=99999,
                current_user=test_user,
                db=db,
            )
        assert exc_info.value.status_code == 404
