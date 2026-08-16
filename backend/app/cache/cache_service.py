import json
import os
from typing import Any

import redis

from ..logging_config import logger

CACHE_VERSION = "v1"
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

class CacheService:
    def __init__(self):
        try:
            self.client: redis.Redis | None = redis.Redis.from_url(
                REDIS_URL, decode_responses=True, socket_connect_timeout=2
            )
            # Ping to verify connection
            self.client.ping()
            self.enabled = True
            logger.info("cache.connected", redis_url=REDIS_URL, version=CACHE_VERSION)
        except Exception as e:
            self.client = None
            self.enabled = False
            logger.warning("cache.offline_mode", reason=str(e))

    def _get_key(self, key: str) -> str:
        return f"snowpulse:{CACHE_VERSION}:{key}"

    def get(self, key: str) -> Any | None:
        if not self.enabled or not self.client:
            return None
        try:
            val = self.client.get(self._get_key(key))
            if val is not None:
                logger.info("cache.hit", key=key)
                return json.loads(val)
            logger.info("cache.miss", key=key)
        except Exception as e:
            logger.error("cache.get_failed", key=key, error=str(e))
        return None

    def set(self, key: str, value: Any, ttl_seconds: int) -> bool:
        if not self.enabled or not self.client:
            return False
        try:
            serialized = json.dumps(value)
            self.client.set(self._get_key(key), serialized, ex=ttl_seconds)
            logger.info("cache.set", key=key, ttl=ttl_seconds)
            return True
        except Exception as e:
            logger.error("cache.set_failed", key=key, error=str(e))
            return False

    def invalidate(self, key: str) -> bool:
        if not self.enabled or not self.client:
            return False
        try:
            self.client.delete(self._get_key(key))
            logger.info("cache.invalidate", key=key)
            return True
        except Exception as e:
            logger.error("cache.invalidate_failed", key=key, error=str(e))
            return False

    def invalidate_pattern(self, pattern: str) -> bool:
        if not self.enabled or not self.client:
            return False
        try:
            full_pattern = self._get_key(pattern)
            keys = self.client.keys(full_pattern)
            if keys:
                self.client.delete(*list(keys))
                logger.info("cache.invalidate_pattern", pattern=pattern, keys_deleted=len(keys))
            return True
        except Exception as e:
            logger.error("cache.invalidate_pattern_failed", pattern=pattern, error=str(e))
            return False

cache_service = CacheService()
