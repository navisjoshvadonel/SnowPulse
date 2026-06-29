from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from .auth import ALGORITHM, JWT_SECRET_KEY
from .database import get_db
from .models import User, UserDashboard

# JWT security scheme mapping to login path
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    """
    Decodes the JWT access token and resolves the user from the database.
    Raises credentials exception if token is invalid, expired, or user is inactive.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        token_type: str = payload.get("type")

        # Verify that this is an access token, not a refresh token
        if email is None or token_type != "access":
            raise credentials_exception

    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is deactivated"
        )

    return user


def verify_dashboard_ownership(
    dashboard_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> UserDashboard:
    """
    Validates that a UserDashboard session exists and is strictly owned by the current logged-in user.
    If the dashboard belongs to another tenant, we return 404 Not Found instead of 403 Forbidden
    to prevent leaking metadata/existence of another tenant's data resource (a key security design choice).
    """
    dashboard = db.query(UserDashboard).filter(UserDashboard.id == dashboard_id).first()

    # Check if dashboard exists and belongs to requesting user
    if not dashboard or dashboard.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard session not found"
        )

    return dashboard
