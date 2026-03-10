from __future__ import annotations

import queue
from concurrent.futures import Future, ThreadPoolExecutor
from typing import Callable, TypeVar

from fastapi import HTTPException

from app.core.config import settings

T = TypeVar("T")

_executor = ThreadPoolExecutor(
    max_workers=settings.MAX_CONCURRENT_AI_REVIEWS,
    thread_name_prefix="logiclens-review",
)
_queue_slots = queue.Queue(maxsize=settings.MAX_QUEUED_AI_REVIEWS)


def submit_review_job(fn: Callable[[], T]) -> Future[T]:
    try:
        _queue_slots.put_nowait(1)
    except queue.Full as exc:
        raise HTTPException(status_code=429, detail="AI queue is full. Please retry in a few seconds.") from exc

    future = _executor.submit(fn)

    def _release_slot(_: Future[T]) -> None:
        try:
            _queue_slots.get_nowait()
        except queue.Empty:
            return

    future.add_done_callback(_release_slot)
    return future
