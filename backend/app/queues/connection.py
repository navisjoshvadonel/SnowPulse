import os
from urllib.parse import urlparse
from arq.connections import RedisSettings, create_pool

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

def get_redis_settings() -> RedisSettings:
    """
    Parse REDIS_URL environment variable to generate arq RedisSettings.
    """
    parsed = urlparse(REDIS_URL)
    host = parsed.hostname or "localhost"
    port = parsed.port or 6379
    password = parsed.password
    db = int(parsed.path.lstrip("/")) if parsed.path else 0
    
    return RedisSettings(
        host=host,
        port=port,
        password=password,
        database=db
    )

async def get_redis_pool():
    """
    Initialize and return an arq Redis connection pool.
    """
    return await create_pool(get_redis_settings())
