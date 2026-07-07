"""
SnowPulse auth.py — PATCHED

Fix applied: removed hardcoded fallback JWT secrets. The original file
shipped two real-looking hex secrets as defaults, committed to a public
GitHub repo. Anyone who reads the repo can forge access AND refresh
tokens for any account. This version fails fast on boot instead.
"""
import datetime
import os
import sys

import bcrypt
from fastapi import Response
from jose import jwt

def _require_secret(env_name: str) -> str:
    value = os.getenv(env_name)
    if not value or len(value) < 32:
        # Fail loudly at startup rather than silently running with a
        # weak/guessable/committed secret. This is intentional — a
        # crash on missing config is much cheaper than a token-forgery
        # vulnerability in production.
        sys.exit(
            f"FATAL: environment variable {env_name} is missing or too short "
            f"(need >=32 chars). Generate one with: "
            f"python -c \"import secrets; print(secrets.token_hex(32))\" "
            f"and set it in your .env / deployment secrets manager."
        )
    return value

JWT_SECRET_KEY = _require_secret("JWT_SECRET_KEY")
JWT_REFRESH_SECRET_KEY = _require_secret("JWT_REFRESH_SECRET_KEY")
ALGORITHM = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies plain password against hashed password using bcrypt."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """Hashes password using bcrypt."""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def create_access_token(data: dict, expires_delta: datetime.timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.datetime.utcnow() + (
        expires_delta or datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: dict, expires_delta: datetime.timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.datetime.utcnow() + (
        expires_delta or datetime.timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    )
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, JWT_REFRESH_SECRET_KEY, algorithm=ALGORITHM)


def set_refresh_token_cookie(response: Response, token: str):
    """
    Sets the refresh token securely in an HttpOnly, SameSite=Strict cookie.
    secure=True is enforced whenever ENV=production.
    """
    response.set_cookie(
        key="refresh_token",
        value=token,
        httponly=True,
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        expires=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        samesite="strict",
        secure=os.getenv("ENV", "development") == "production",
        path="/api/auth",
    )


def delete_refresh_token_cookie(response: Response):
    """Deletes the refresh token cookie by zeroing max_age/expires."""
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
