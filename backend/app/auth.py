import os
import datetime
from typing import Optional
import bcrypt
from jose import jwt
from fastapi import Response


# Secret keys configuration (Default fallback for dev, must be loaded from env in production)
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "7d4a2ef39b0394017de8b71d9d9fcaee8d203a985a21db4b830d9e83cd1891b9")
JWT_REFRESH_SECRET_KEY = os.getenv("JWT_REFRESH_SECRET_KEY", "b30d9e83cd1891b97d4a2ef39b0394017de8b71d9d9fcaee8d203a985a21db4b")
ALGORITHM = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies plain password against hashed password using bcrypt.
    """
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    """
    Hashes password using bcrypt.
    """
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def create_access_token(data: dict, expires_delta: Optional[datetime.timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.datetime.utcnow() + expires_delta
    else:
        expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict, expires_delta: Optional[datetime.timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.datetime.utcnow() + expires_delta
    else:
        expire = datetime.datetime.utcnow() + datetime.timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, JWT_REFRESH_SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def set_refresh_token_cookie(response: Response, token: str):
    """
    Sets the refresh token securely in an HttpOnly, SameSite=Strict cookie.
    We also set secure=True in production to enforce TLS/SSL (HTTPS).
    """
    response.set_cookie(
        key="refresh_token",
        value=token,
        httponly=True,
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        expires=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        samesite="strict",
        secure=os.getenv("ENV", "development") == "production",
        path="/api/auth",  # Scopes cookie to auth routes to prevent leakage to other components
    )

def delete_refresh_token_cookie(response: Response):
    """
    Deletes the refresh token cookie by setting its max_age and expires to 0.
    """
    response.set_cookie(
        key="refresh_token",
        value="",
        httponly=True,
        max_age=0,
        expires=0,
        samesite="strict",
        secure=os.getenv("ENV", "development") == "production",
        path="/api/auth",
    )
