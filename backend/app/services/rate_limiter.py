import logging
import time
from collections import defaultdict, deque

import redis

from app.core.config import settings

logger = logging.getLogger(__name__)
_WINDOW_SECONDS = 60
_local_buckets: dict[str, deque[float]] = defaultdict(deque)


class RateLimitExceeded(Exception):
    pass


def _redis_client():
    if not settings.REDIS_URL:
        return None

    try:
        return redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
    except Exception as exc:
        logger.warning("Redis unavailable, falling back to local rate limiter: %s", exc)
        return None


def check_rate_limit(key: str, limit: int):
    now = time.time()
    client = _redis_client()

    if client is not None:
        window_key = f"ratelimit:{key}"
        try:
            pipe = client.pipeline()
            pipe.zremrangebyscore(window_key, 0, now - _WINDOW_SECONDS)
            pipe.zadd(window_key, {str(now): now})
            pipe.zcard(window_key)
            pipe.expire(window_key, _WINDOW_SECONDS)
            _, _, count, _ = pipe.execute()
            if int(count) > limit:
                raise RateLimitExceeded("Rate limit exceeded. Try again in a minute.")
            return
        except RateLimitExceeded:
            raise
        except Exception as exc:
            logger.warning("Redis rate limit check failed, using local fallback: %s", exc)

    bucket = _local_buckets[key]
    while bucket and bucket[0] <= now - _WINDOW_SECONDS:
        bucket.popleft()
    bucket.append(now)
    if len(bucket) > limit:
        raise RateLimitExceeded("Rate limit exceeded. Try again in a minute.")
