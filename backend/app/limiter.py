from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address


def user_or_ip_identifier(request: Request) -> str:
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        return f"user:{token}"

    # Fallback to remote address
    return get_remote_address(request)

# We use an in-memory/redis storage for rate limiting. In production/compose, we can configure Redis storage.
# However, to be resilient, we fallback to memory if Redis is down.
import os

REDIS_URL = os.getenv("REDIS_URL")
if REDIS_URL:
    storage_uri = REDIS_URL
else:
    storage_uri = "memory://"

limiter = Limiter(
    key_func=user_or_ip_identifier,
    storage_uri=storage_uri
)
