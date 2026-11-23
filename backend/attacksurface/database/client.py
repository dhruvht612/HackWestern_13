from __future__ import annotations

from functools import lru_cache
from typing import Any

import httpx
from supabase import ClientOptions, create_client

from attacksurface.config import settings

# PostgREST PATCH sets column values, so resending it is safe. POST (insert, rpc) is not.
_RESENDABLE = {"GET", "HEAD", "PUT", "PATCH", "DELETE", "OPTIONS"}


class ConfigError(RuntimeError):
    """A required setting is missing. Surfaces as HTTP 503, never as an import-time crash."""


class _ResendOnDisconnect(httpx.HTTPTransport):
    """Resend an idempotent request once when the server drops the connection before replying.

    Every request shares one pooled connection. A single drop ("RemoteProtocolError: Server
    disconnected") used to fail a whole scan, because postgrest only retries GET and HEAD.
    """

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        try:
            return super().handle_request(request)
        except httpx.RemoteProtocolError:
            if request.method not in _RESENDABLE:
                raise
            return super().handle_request(request)


@lru_cache(maxsize=1)
def _service_client() -> Any:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise ConfigError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    # Same settings supabase's own default client uses (HTTP/2, 120 s, follow redirects), plus the resend.
    http = httpx.Client(transport=_ResendOnDisconnect(http2=True), timeout=120, follow_redirects=True)
    # Service role bypasses RLS: every query below this layer must be scoped to the caller.
    return create_client(settings.supabase_url, settings.supabase_service_role_key, options=ClientOptions(httpx_client=http))


def get_db() -> Any:
    """FastAPI dependency (tests override it with an in-memory fake)."""
    return _service_client()


def new_auth_client() -> Any:
    """A fresh anon-key client for Supabase Auth calls.

    Auth calls store a user session on the client they run on; using a separate client keeps
    that session away from the service-role client used for data access.
    """
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise ConfigError("SUPABASE_URL and SUPABASE_ANON_KEY must be set")
    return create_client(settings.supabase_url, settings.supabase_anon_key)
