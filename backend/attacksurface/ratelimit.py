from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from collections.abc import Callable

from fastapi import HTTPException

from attacksurface.config import settings


class RateLimiter:
    """Sliding-window limiter keyed by caller + action.

    ponytail: in-process, so limits are per API instance. Run one instance, or move this
    to Redis / a Postgres counter when deploying more than one.
    """

    def __init__(self, scale: int = 1) -> None:
        self._scale = scale
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._notified: dict[str, float] = {}  # last time on_limited fired, per key
        self._lock = threading.Lock()
        # Called with the key on the first refusal per key per window (set in main.py to log an
        # event), so a flood of refused requests costs one DB write, not one per request.
        self.on_limited: Callable[[str], None] | None = None

    def check(self, key: str, limit: int, window: float = 60.0) -> None:
        limit *= self._scale
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            while hits and now - hits[0] >= window:
                hits.popleft()
            retry = int(window - (now - hits[0])) + 1 if len(hits) >= limit else 0
            if not retry:
                hits.append(now)
            notify = bool(retry) and now - self._notified.get(key, float("-inf")) >= window
            if notify:
                self._notified[key] = now
        if retry:
            if notify and self.on_limited is not None:
                try:
                    self.on_limited(key)
                except Exception:  # noqa: BLE001, S110 - a logging hook never changes the response
                    pass
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Try again shortly.",
                headers={"Retry-After": str(retry)},
            )

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()
            self._notified.clear()


limiter = RateLimiter(settings.rate_limit_scale)
