from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException


class RateLimiter:
    """Sliding-window limiter keyed by caller + action.

    ponytail: in-process, so limits are per API instance. Run one instance, or move this
    to Redis / a Postgres counter when deploying more than one.
    """

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str, limit: int, window: float = 60.0) -> None:
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            while hits and now - hits[0] >= window:
                hits.popleft()
            if len(hits) >= limit:
                retry = int(window - (now - hits[0])) + 1
                raise HTTPException(
                    status_code=429,
                    detail="Too many requests. Try again shortly.",
                    headers={"Retry-After": str(retry)},
                )
            hits.append(now)

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


limiter = RateLimiter()
