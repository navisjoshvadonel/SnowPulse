import os
import sys

# Ensure both workspace root and backend directory are in sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
workspace_dir = os.path.dirname(backend_dir)
if workspace_dir not in sys.path:
    sys.path.insert(0, workspace_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import pytest
from fastapi.testclient import TestClient

# Configure testing env vars
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["JWT_SECRET_KEY"] = "testsecretkeytestsecretkeytestsecretkey"
os.environ["JWT_REFRESH_SECRET_KEY"] = "testrefreshsecretkeytestrefreshsecretkey"
os.environ["ENV"] = "testing"

try:
    from backend.app.auth import create_access_token
    from backend.app.database import Base, SessionLocal, engine, get_db
    from backend.app.main import app
except ModuleNotFoundError:
    from app.auth import create_access_token  # type: ignore[no-redef]
    from app.database import Base, SessionLocal, engine, get_db  # type: ignore[no-redef]
    from app.main import app  # type: ignore[no-redef]


@pytest.fixture(scope="session", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def db():
    connection = engine.connect()
    transaction = connection.begin()
    session = SessionLocal(bind=connection)

    # Pre-populate some tables if needed
    yield session

    session.close()
    transaction.rollback()
    connection.close()

@pytest.fixture(autouse=True)
def override_db(db):
    def _get_db():
        try:
            yield db
        finally:
            pass
    app.dependency_overrides[get_db] = _get_db
    yield
    app.dependency_overrides.clear()

@pytest.fixture
def client():
    # Clear rate limiter during unit tests to avoid 429
    try:
        from backend.app.limiter import limiter
    except ModuleNotFoundError:
        from app.limiter import limiter  # type: ignore[no-redef]
    limiter.enabled = False

    with TestClient(app) as c:
        yield c

    limiter.enabled = True

@pytest.fixture
def test_user(db):
    try:
        from backend.app.auth import get_password_hash
        from backend.app.models import User
    except ModuleNotFoundError:
        from app.auth import get_password_hash  # type: ignore[no-redef]
        from app.models import User  # type: ignore[no-redef]

    user = User(
        email="testuser@snowpulse.com",
        hashed_password=get_password_hash("password123"),
        is_active=True
    )

    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@pytest.fixture
def auth_headers(test_user):
    token = create_access_token(data={"sub": test_user.email})
    return {"Authorization": f"Bearer {token}"}
