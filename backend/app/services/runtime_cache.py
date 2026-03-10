import hashlib
import json
import threading
import time
from typing import Any, Callable

_cache: dict[str, tuple[float, Any]] = {}
_cache_lock = threading.Lock()
_inflight_events: dict[str, threading.Event] = {}


def get_cached(key: str):
    with _cache_lock:
        cached = _cache.get(key)
        if not cached:
            return None
        if cached[0] <= time.time():
            _cache.pop(key, None)
            return None
        return cached[1]


def set_cached(key: str, ttl_seconds: int, value: Any):
    with _cache_lock:
        _cache[key] = (time.time() + ttl_seconds, value)
    return value


def get_or_set(key: str, ttl_seconds: int, loader: Callable[[], Any]):
    cached = get_cached(key)
    if cached is not None:
        return cached

    with _cache_lock:
        wait_event = _inflight_events.get(key)
        if wait_event is None:
            wait_event = threading.Event()
            _inflight_events[key] = wait_event
            is_loader = True
        else:
            is_loader = False

    if not is_loader:
        wait_event.wait(timeout=ttl_seconds)
        cached = get_cached(key)
        if cached is not None:
            return cached
        return loader()

    try:
        value = loader()
        return set_cached(key, ttl_seconds, value)
    finally:
        with _cache_lock:
            event = _inflight_events.pop(key, None)
            if event is not None:
                event.set()


def invalidate_prefix(prefix: str):
    with _cache_lock:
        stale_keys = [key for key in _cache if key.startswith(prefix)]
        for key in stale_keys:
            _cache.pop(key, None)


def make_review_cache_key(user_id: int, payload: dict[str, Any]) -> str:
    normalized = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
    return f"review-result:{user_id}:{digest}"
