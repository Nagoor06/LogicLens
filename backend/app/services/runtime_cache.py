import threading
import time
from typing import Any, Callable

_cache: dict[str, tuple[float, Any]] = {}
_cache_lock = threading.Lock()


def get_or_set(key: str, ttl_seconds: int, loader: Callable[[], Any]):
    now = time.time()
    with _cache_lock:
        cached = _cache.get(key)
        if cached and cached[0] > now:
            return cached[1]

    value = loader()
    with _cache_lock:
        _cache[key] = (now + ttl_seconds, value)
    return value


def invalidate_prefix(prefix: str):
    with _cache_lock:
        stale_keys = [key for key in _cache if key.startswith(prefix)]
        for key in stale_keys:
            _cache.pop(key, None)
