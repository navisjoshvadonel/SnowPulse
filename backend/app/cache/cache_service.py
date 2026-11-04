import fnmatch
import json
import os
import time
from typing import Any

import redis

from ..logging_config import logger

CACHE_VERSION = "v1"
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

class CacheService:
    def __init__(self):
        self._memory_cache: dict[str, tuple[Any, float]] = {}
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
            logger.info("cache.in_memory_fallback", reason=str(e), note="Using high-performance in-memory TTL cache for native Ubuntu execution")

    def _get_key(self, key: str) -> str:
        return f"snowpulse:{CACHE_VERSION}:{key}"

    def get(self, key: str) -> Any | None:
        if not self.enabled:
            return None
        full_key = self._get_key(key)
        if self.client:
            try:
                val = self.client.get(full_key)
                if val is not None:
                    logger.info("cache.hit", key=key)
                    return json.loads(val)
                logger.info("cache.miss", key=key)
            except Exception as e:
                logger.error("cache.get_failed", key=key, error=str(e))
            return None

        # In-memory fallback
        if full_key in self._memory_cache:
            val, expiry = self._memory_cache[full_key]
            if expiry > time.time():
                logger.info("cache.memory_hit", key=key)
                return val
            else:
                del self._memory_cache[full_key]
        logger.info("cache.memory_miss", key=key)
        return None

    def set(self, key: str, value: Any, ttl_seconds: int) -> bool:
        if not self.enabled:
            return False
        full_key = self._get_key(key)
        if self.client:
            try:
                serialized = json.dumps(value)
                self.client.set(full_key, serialized, ex=ttl_seconds)
                logger.info("cache.set", key=key, ttl=ttl_seconds)
                return True
            except Exception as e:
                logger.error("cache.set_failed", key=key, error=str(e))
                return False

        # In-memory fallback
        self._memory_cache[full_key] = (value, time.time() + ttl_seconds)
        if len(self._memory_cache) > 1000:
            now = time.time()
            expired = [k for k, (_, exp) in self._memory_cache.items() if exp <= now]
            for k in expired:
                self._memory_cache.pop(k, None)
        return True

    def invalidate(self, key: str) -> bool:
        if not self.enabled:
            return False
        full_key = self._get_key(key)
        if self.client:
            try:
                self.client.delete(full_key)
                logger.info("cache.invalidate", key=key)
                return True
            except Exception as e:
                logger.error("cache.invalidate_failed", key=key, error=str(e))
                return False

        self._memory_cache.pop(full_key, None)
        return True

    def invalidate_pattern(self, pattern: str) -> bool:
        if not self.enabled:
            return False
        full_pattern = self._get_key(pattern)
        if self.client:
            try:
                keys = self.client.keys(full_pattern)
                if keys:
                    self.client.delete(*list(keys))
                    logger.info("cache.invalidate_pattern", pattern=pattern, keys_deleted=len(keys))
                return True
            except Exception as e:
                logger.error("cache.invalidate_pattern_failed", pattern=pattern, error=str(e))
                return False

        matched = [k for k in self._memory_cache.keys() if fnmatch.fnmatch(k, full_pattern)]
        for k in matched:
            self._memory_cache.pop(k, None)
        return True

cache_service = CacheService()
