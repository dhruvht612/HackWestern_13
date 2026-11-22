"""Caller address for logs and risk signals."""

from __future__ import annotations

from fastapi import Request

from attacksurface.config import settings


def client_ip(request: Request, trusted_proxies: int | None = None) -> str | None:
    """The caller's IP. X-Forwarded-For is only believed for the configured number of proxies:
    each trusted proxy appends the address it saw, so the n-th entry from the right is the one
    the outermost trusted proxy received. Anything left of that is client-supplied and spoofable.
    """
    n = settings.trusted_proxy_count if trusted_proxies is None else trusted_proxies
    socket_ip = request.client.host if request.client else None
    if n <= 0:
        return socket_ip
    hops = [h.strip() for h in request.headers.get("x-forwarded-for", "").split(",") if h.strip()]
    return hops[-n] if len(hops) >= n else socket_ip
